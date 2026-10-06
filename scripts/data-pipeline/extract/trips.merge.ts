import type { GeneratedTrip } from "@/features/travel-explorer/data/generated-data.schema";
import { getCountryReference } from "@/lib/geo/country-reference";
import type { SourceRef } from "@/types/travel.types";

import { groupBy } from "../lib/collections";
import { addDaysIso } from "../lib/dates";
import type { TripClaim, TripSourceId } from "../types";

/**
 * Merges the claims of one official into trips. Sources often report the same trip (Wikipedia
 * and COLT both list most leaders' visits), and one source can list a trip once per city. Claims
 * to the same country whose dates overlap (a day's leeway either side) are one trip.
 */

/** Lower is more trustworthy: official records first, then curated lists, then research data. */
const SOURCE_RANK: Readonly<Record<TripSourceId, number>> = {
    "au-ipea": 0,
    canada: 0,
    colt: 2,
    "gov-uk": 0,
    historian: 0,
    "historian-visits": 0,
    "nepal-mofa": 1,
    relations: 1,
    summits: 1,
    "uk-parliament": 0,
    "un-general-debate": 1,
    "who-assembly": 0,
    wikipedia: 1,
};
const PRECISION_RANK = { day: 0, month: 1, year: 2 } as const;
const MAX_ENGAGEMENTS = 2;

const compareTrust = (a: TripClaim, b: TripClaim): number =>
    PRECISION_RANK[a.datePrecision] - PRECISION_RANK[b.datePrecision] ||
    SOURCE_RANK[a.source] - SOURCE_RANK[b.source] ||
    Number(a.destination.precision === "country") - Number(b.destination.precision === "country");

const overlaps = (claim: TripClaim, start: string, end: string): boolean =>
    claim.startDate <= addDaysIso(end, 1) && claim.endDate >= addDaysIso(start, -1);

/**
 * Groups claims to one country into trips. Day-precision claims form the trips; a claim known
 * only to the month or year joins a trip it overlaps, but never stretches it, and stands alone
 * otherwise.
 */
const clusterClaims = (claims: readonly TripClaim[]): TripClaim[][] => {
    const precise = claims
        .filter((claim) => claim.datePrecision === "day")
        .sort((a, b) => a.startDate.localeCompare(b.startDate));
    const clusters: { claims: TripClaim[]; end: string; start: string }[] = [];
    for (const claim of precise) {
        const current = clusters.at(-1);
        if (current && overlaps(claim, current.start, current.end)) {
            current.claims.push(claim);
            current.end = claim.endDate > current.end ? claim.endDate : current.end;
        } else {
            clusters.push({ claims: [claim], end: claim.endDate, start: claim.startDate });
        }
    }

    const loose = new Map<string, TripClaim[]>();
    for (const claim of claims.filter((candidate) => candidate.datePrecision !== "day")) {
        const host = clusters.find((cluster) => overlaps(claim, cluster.start, cluster.end));
        if (host) {
            host.claims.push(claim);
        } else {
            const key = `${claim.startDate}|${claim.endDate}`;
            loose.set(key, [...(loose.get(key) ?? []), claim]);
        }
    }
    return [...clusters.map((cluster) => cluster.claims), ...loose.values()];
};

const firstOf = <T>(
    claims: readonly TripClaim[],
    pick: (claim: TripClaim) => T | null
): T | null => {
    for (const claim of claims) {
        const value = pick(claim);
        if (value !== null) {
            return value;
        }
    }
    return null;
};

/** One trip from the claims describing it, taking each detail from the most trusted source. */
const tripFromCluster = (cluster: readonly TripClaim[], officialId: string): GeneratedTrip => {
    const ranked = [...cluster].sort(compareTrust);
    const [best] = ranked;
    // Rows of one source listing the same trip city by city together give its full span.
    const endDate = ranked
        .filter(
            (claim) => claim.source === best.source && claim.datePrecision === best.datePrecision
        )
        .map((claim) => claim.endDate)
        .reduce((latest, date) => (date > latest ? date : latest), best.endDate);
    const destination =
        ranked.find((claim) => claim.destination.precision !== "country")?.destination ??
        best.destination;
    const country = getCountryReference(destination.countryCode)?.name ?? destination.city;
    // One link per source: a ministry's daily releases about one visit are listed once.
    const sources = new Map<string, SourceRef>();
    for (const claim of [...cluster].sort(
        (a, b) => SOURCE_RANK[a.source] - SOURCE_RANK[b.source]
    )) {
        if (!sources.has(claim.sourceRef.label)) {
            sources.set(claim.sourceRef.label, claim.sourceRef);
        }
    }

    return {
        datePrecision: best.datePrecision,
        destination,
        endDate,
        engagements: [...new Set(ranked.flatMap((claim) => claim.engagements))].slice(
            0,
            MAX_ENGAGEMENTS
        ),
        eventName: firstOf(ranked, (claim) => claim.eventName),
        id: `${officialId}--${best.startDate}--${destination.countryCode}`,
        officialId,
        purpose: firstOf(ranked, (claim) => claim.purpose) ?? `Visit to ${country}`,
        sources: [...sources.values()],
        startDate: best.startDate,
        statusHint: firstOf(ranked, (claim) => claim.statusHint),
        type: ranked.find((claim) => claim.type !== "other")?.type ?? "other",
    };
};

/**
 * Turns one official's claims into trips.
 *
 * @param claims - Every claim matched to the official.
 * @param officialId - The official's id.
 * @returns Trips sorted by start date.
 */
export const mergeClaims = (claims: readonly TripClaim[], officialId: string): GeneratedTrip[] => {
    const trips = [...groupBy(claims, (claim) => claim.destination.countryCode).values()]
        .flatMap(clusterClaims)
        .map((cluster) => tripFromCluster(cluster, officialId))
        .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id));

    // Two trips can only share an id if a loose claim stands alone on a precise trip's start day.
    const seen = new Map<string, number>();
    return trips.map((trip) => {
        const count = (seen.get(trip.id) ?? 0) + 1;
        seen.set(trip.id, count);
        return count === 1 ? trip : { ...trip, id: `${trip.id}-${count}` };
    });
};

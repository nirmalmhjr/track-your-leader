import type { GeneratedTrip } from "@/features/travel-explorer/data/generated-data.schema";
import type { CountryCode } from "@/types/geo.types";
import type { IsoDate } from "@/types/travel.types";

import { normalizeName } from "../lib/text";
import { readCountries, type WarehouseOfficial, writeWarehouseFile } from "../lib/warehouse";

/**
 * The data audit (`data/warehouse/audit.json`): checks for what shouldn't be in the data, or is
 * missing from it, each as a count with examples. It runs after every collection, so a fix shows
 * in the next run and a regression in the one after.
 */

const MS_PER_DAY = 86_400_000;
const EXAMPLES = 15;
/** A day-precise trip longer than this is a stay (exile, treatment, a posting), not a visit. */
export const LONGEST_VISIT_DAYS = 60;
/** Trips this many days apart to one country, reported by different sources, are one trip. */
const NEAR_DUPLICATE_DAYS = 5;
/** Years either side of a person's known career before a trip looks like someone else's. */
const CAREER_MARGIN_YEARS = 15;
const LEADER_CATEGORIES = new Set(["head_of_state", "head_of_government"]);
const QID_NAME = /^Q\d+$/;
/** Names with a letter outside Latin (accented Latin and the ʻokina allowed). */
const NON_LATIN_NAME = /[^\p{Script=Latin}\p{M}\p{N}\s.,'’ʻ()&/-]/u;

interface Check {
    count: number;
    examples: string[];
}

const check = (lines: readonly string[]): Check => ({
    count: lines.length,
    examples: lines.slice(0, EXAMPLES),
});

const days = (from: IsoDate, to: IsoDate): number =>
    Math.round((Date.parse(to) - Date.parse(from)) / MS_PER_DAY);

interface CountryData {
    officials: WarehouseOfficial[];
    trips: GeneratedTrip[];
}

const sourceUrls = (trip: GeneratedTrip): Set<string> =>
    new Set(trip.sources.map((source) => source.url));

/** Trips to one country by one person, a few days apart, reported by different sources. */
const nearDuplicates = (
    code: CountryCode,
    file: CountryData,
    nameOf: (id: string) => string
): string[] => {
    const lines: string[] = [];
    const byTraveller = new Map<string, GeneratedTrip[]>();
    for (const trip of file.trips) {
        if (trip.datePrecision === "day") {
            const key = `${trip.officialId}|${trip.destination.countryCode}`;
            byTraveller.set(key, [...(byTraveller.get(key) ?? []), trip]);
        }
    }
    for (const trips of byTraveller.values()) {
        const sorted = [...trips].sort((a, b) => a.startDate.localeCompare(b.startDate));
        for (const [index, next] of sorted.slice(1).entries()) {
            const previous = sorted[index];
            const gap = previous ? days(previous.endDate, next.startDate) : 0;
            const shared = previous
                ? [...sourceUrls(previous)].some((url) => sourceUrls(next).has(url))
                : true;
            if (previous && gap > 1 && gap <= NEAR_DUPLICATE_DAYS && !shared) {
                lines.push(
                    `${code} · ${nameOf(next.officialId)} → ${next.destination.countryCode}: ${previous.startDate} and ${next.startDate}`
                );
            }
        }
    }
    return lines;
};

/** Every office category held today by more than one person, or by nobody. */
const currentHeads = (code: CountryCode, officials: readonly WarehouseOfficial[]) => {
    const holders = new Map<string, Set<string>>();
    for (const official of officials) {
        for (const position of official.positions) {
            const isCurrent = position.endDate === null && !position.undated && position.startDate;
            for (const category of isCurrent ? position.categories : []) {
                if (LEADER_CATEGORIES.has(category)) {
                    holders.set(
                        category,
                        (holders.get(category) ?? new Set()).add(official.fullName)
                    );
                }
            }
        }
    }
    return {
        missing: [...LEADER_CATEGORIES]
            .filter((category) => !holders.has(category))
            .map((category) => `${code} · ${category}`),
        several: [...holders]
            .filter(([, names]) => names.size > 1)
            .map(([category, names]) => `${code} · ${category}: ${[...names].join(", ")}`),
    };
};

/** Trips far from any term the person is known to have held: a wrong match or a missing term. */
const outsideCareer = (
    code: CountryCode,
    file: CountryData,
    byId: ReadonlyMap<string, WarehouseOfficial>
): string[] =>
    file.trips.flatMap((trip) => {
        const official = byId.get(trip.officialId);
        const dated = official?.positions.filter((position) => position.startDate) ?? [];
        if (!official || dated.length === 0) {
            return [];
        }
        const first = Math.min(...dated.map((position) => Number(position.startDate?.slice(0, 4))));
        const last = Math.max(
            ...dated.map((position) => Number((position.endDate ?? trip.startDate).slice(0, 4)))
        );
        const year = Number(trip.startDate.slice(0, 4));
        return year < first - CAREER_MARGIN_YEARS || year > last + CAREER_MARGIN_YEARS
            ? [`${code} · ${official.fullName}: trip ${trip.startDate}, career ${first}–${last}`]
            : [];
    });

const CHECKS = [
    "currentHeadsMissing",
    "currentHeadsSeveral",
    "duplicateTerms",
    "futureTripsNotPlanned",
    "longStays",
    "nearDuplicateTrips",
    "nonLatinNames",
    "qidNames",
    "sameNameTwins",
    "tripsOutsideCareer",
    "withoutWikidata",
] as const;
type CheckName = (typeof CHECKS)[number];
type Findings = Record<CheckName, string[]>;

/** Checks on one country's officials: names, ids, duplicate terms and twins. */
const auditOfficials = (
    code: CountryCode,
    officials: readonly WarehouseOfficial[],
    found: Findings
): void => {
    const names = new Map<string, string[]>();
    for (const official of officials) {
        const terms = official.positions.map((p) => `${p.title}|${p.startDate}|${p.endDate}`);
        if (new Set(terms).size < terms.length) {
            found.duplicateTerms.push(`${code} · ${official.fullName}`);
        }
        if (QID_NAME.test(official.fullName)) {
            found.qidNames.push(`${code} · ${official.fullName}`);
        } else if (NON_LATIN_NAME.test(official.fullName)) {
            found.nonLatinNames.push(`${code} · ${official.fullName}`);
        }
        if (!official.wikidataId) {
            found.withoutWikidata.push(`${code} · ${official.fullName}`);
        }
        const key = normalizeName(official.fullName);
        names.set(key, [...(names.get(key) ?? []), official.wikidataId ?? "no id"]);
    }
    for (const [name, ids] of names) {
        if (ids.length > 1 && name) {
            found.sameNameTwins.push(`${code} · ${name}: ${ids.join(", ")}`);
        }
    }
};

/** Checks on one country's trips: long stays and unmarked future trips. */
const auditTrips = (
    code: CountryCode,
    file: CountryData,
    nameOf: (id: string) => string,
    today: IsoDate,
    found: Findings
): void => {
    for (const trip of file.trips) {
        // Long stays are kept, typed "extended_stay"; one shown as a visit is a mistake.
        if (
            trip.datePrecision === "day" &&
            days(trip.startDate, trip.endDate) > LONGEST_VISIT_DAYS &&
            trip.type !== "extended_stay"
        ) {
            found.longStays.push(
                `${code} · ${nameOf(trip.officialId)} in ${trip.destination.countryCode}: ${trip.startDate} – ${trip.endDate}`
            );
        }
        if (trip.startDate > today && trip.statusHint !== "planned") {
            found.futureTripsNotPlanned.push(
                `${code} · ${nameOf(trip.officialId)}: ${trip.startDate}`
            );
        }
    }
};

/**
 * Runs every check over the stored country files and writes the audit.
 *
 * @param today - Today's date.
 * @returns The count per check.
 */
export const writeAudit = async (today: IsoDate): Promise<Record<string, number>> => {
    const files = await readCountries();
    const found = Object.fromEntries(CHECKS.map((name) => [name, [] as string[]])) as Findings;
    for (const [code, file] of files) {
        const byId = new Map(file.officials.map((official) => [official.id, official]));
        const nameOf = (id: string): string => byId.get(id)?.fullName ?? id;
        const heads = currentHeads(code, file.officials);
        found.currentHeadsMissing.push(...heads.missing);
        found.currentHeadsSeveral.push(...heads.several);
        found.nearDuplicateTrips.push(...nearDuplicates(code, file, nameOf));
        found.tripsOutsideCareer.push(...outsideCareer(code, file, byId));
        auditOfficials(code, file.officials, found);
        auditTrips(code, file, nameOf, today, found);
    }
    const audit = Object.fromEntries(CHECKS.map((name) => [name, check(found[name])]));
    await writeWarehouseFile("audit.json", { generatedOn: today, ...audit });
    return Object.fromEntries(CHECKS.map((name) => [name, found[name].length]));
};

import type { CountryCode } from "@/types/geo.types";

import { daysInMonth, isoFromParts } from "../../lib/dates";
import { log } from "../../lib/log";
import { fetchDelegationLines, WHO_ASSEMBLIES, whoDocumentUrl } from "../../sources/who-assembly";
import type { SkippedRow, TripClaim } from "../../types";
import type { CityLookup } from "../places.resolve";
import { parseDelegations } from "./un-delegations.parse";

/**
 * World Health Assembly delegations: each year almost every health minister goes to Geneva,
 * so these lists give a yearly trip for ministers whose travel no other source records. The
 * assembly meets in May; the lists don't say which days each minister attended, so the trips
 * are dated to the month.
 */

const VENUE_CITY = "Geneva";
const VENUE_COUNTRY: CountryCode = "CHE";
const MAY = 5;

interface AssemblyInput {
    cities: CityLookup;
}

/**
 * Every member of government listed in the World Health Assembly delegations.
 *
 * @returns One claim per minister and assembly, and assemblies that couldn't be read.
 */
export const extractWhoAssemblyClaims = async ({
    cities,
}: AssemblyInput): Promise<{ claims: TripClaim[]; skipped: SkippedRow[] }> => {
    cities.request(VENUE_COUNTRY, VENUE_CITY);
    await cities.load();
    const venue = cities.place(VENUE_COUNTRY, VENUE_CITY);
    if (!venue) {
        throw new Error("Geneva could not be located");
    }

    const claims: TripClaim[] = [];
    const skipped: SkippedRow[] = [];
    for (const { file, number, year } of WHO_ASSEMBLIES) {
        // biome-ignore lint/performance/noAwaitInLoops: one large document at a time.
        const lines = await fetchDelegationLines(file);
        if (!lines) {
            skipped.push({ reason: "list not readable", text: file });
            continue;
        }
        const delegates = parseDelegations(lines);
        log.info(`WHA${number} (${year}): ${delegates.length} members of government`);
        for (const delegate of delegates) {
            claims.push({
                datePrecision: "month",
                destination: venue,
                endDate: isoFromParts(year, MAY, daysInMonth(year, MAY)),
                engagements: [],
                eventName: "World Health Assembly",
                purpose: `Led or joined their country's delegation to the World Health Assembly (WHA${number})`,
                source: "who-assembly",
                sourceRef: { label: "World Health Organization", url: whoDocumentUrl(file) },
                startDate: isoFromParts(year, MAY, 1),
                statusHint: null,
                traveller: {
                    categories: delegate.categories,
                    countryCode: delegate.countryCode,
                    familyName: delegate.familyName,
                    // Initials only: matched by family name and office, never added as a new official.
                    name: null,
                    portfolio: delegate.portfolio,
                    title: delegate.title,
                    wikidataId: null,
                },
                type: "multilateral_meeting",
            });
        }
    }
    return { claims, skipped };
};

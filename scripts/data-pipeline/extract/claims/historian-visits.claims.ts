import type { RoleCategory } from "@/types/travel.types";

import { PIPELINE_CONFIG } from "../../config";
import { cleanText } from "../../lib/text";
import {
    fetchHistorianVisits,
    HISTORIAN_VISITS_URL,
    type HistorianVisit,
} from "../../sources/historian-visits";
import type { SkippedRow, TravellerHint, TripClaim } from "../../types";
import { countryCodeOfName, countryPlace, type PlaceIndex } from "../places.resolve";
import { classifyTripType, detectEventName } from "../trip-type.classify";
import { shorten } from "./wikipedia.claims";

/**
 * Office of the Historian "Visits by Foreign Leaders": each visit becomes a trip to the United
 * States by the visiting leader. The source names the visitor with a title ("King Hussein",
 * "Prime Minister John Howard"); the title gives the role, which also identifies leaders whose
 * names are spelled differently elsewhere.
 */

const HOST = "USA";
/** Visits before the warehouse's first year: their visitors' terms aren't collected. */
const FIRST_YEAR = String(PIPELINE_CONFIG.warehouseSinceYear);
const MAX_PURPOSE_LENGTH = 140;

/** Leading titles, checked in order; the rest of the text is the name. */
const TITLES: readonly (readonly [RegExp, string, RoleCategory[]])[] = [
    [/^(?:interim|acting|provisional) president\b/i, "President", ["head_of_state"]],
    [/^vice president\b/i, "Vice President", ["deputy_leader"]],
    [/^president\b/i, "President", ["head_of_state"]],
    [/^(?:deputy prime minister|vice premier)\b/i, "Deputy Prime Minister", ["deputy_leader"]],
    // The source has a few typos: "Prime Minster", "Prime MinisterHaidar".
    [/^prime mini?ste?re?/i, "Prime Minister", ["head_of_government"]],
    [/^(?:premier|chancellor|taoiseach)\b/i, "Head of government", ["head_of_government"]],
    [/^crown prince\b/i, "Crown Prince", []],
    [/^governor[- ]general\b/i, "Governor-General", []],
    [
        /^(?:king|queen|emperor|empress|shah|sultan|emir|amir|grand duke|grand duchess|pope|regent prince)\b/i,
        "Monarch",
        ["head_of_state"],
    ],
    // Princes rule only in principalities; elsewhere a prince may be any royal (a Saudi minister).
    [/^prince\b/i, "Prince", []],
];
const PRINCIPALITIES: ReadonlySet<string> = new Set(["LIE", "MCO"]);
/** Not in office yet, or no longer: their trips aren't official travel. */
const NOT_IN_OFFICE = /^(?:\S+-(?:elect|designate)|former)\b/i;
/** "President X and Prime Minister Y" lists two travellers. */
const SECOND_VISITOR =
    /\s+and\s+(?=(?:president|prime minister|crown prince|king|queen|chancellor|premier)\b)/i;
const SLUG_SEPARATOR = /-/g;

/**
 * Splits "Prime Minister John Howard" into the role and the name.
 *
 * @param visitor - Visitor as written by the source.
 * @returns The traveller's title, role and name; `null` for visitors not in office.
 */
export const readVisitor = (
    visitor: string
): { categories: RoleCategory[]; name: string | null; title: string | null } | null => {
    const text = cleanText(visitor);
    if (NOT_IN_OFFICE.test(text)) {
        return null;
    }
    for (const [pattern, title, categories] of TITLES) {
        const match = text.match(pattern);
        if (match) {
            const name = cleanText(text.slice(match[0].length));
            return { categories, name: name || null, title };
        }
    }
    return { categories: [], name: text || null, title: null };
};

/**
 * Converts one visit: one claim per visitor in office.
 *
 * @param visit - Visit from the source.
 * @param places - Place index, for the destination's capital.
 * @returns The claims, or why the visit was skipped.
 */
export const claimsFromHistorianVisit = (
    visit: HistorianVisit,
    places: PlaceIndex
): TripClaim[] | SkippedRow => {
    const code =
        countryCodeOfName(visit.from) ??
        countryCodeOfName(visit.fromId.replace(SLUG_SEPARATOR, " "));
    if (!code || code === HOST) {
        return { reason: "visiting country not found", text: visit.from };
    }
    const destination = countryPlace(places, HOST);
    if (!destination) {
        return { reason: "destination not found", text: HOST };
    }
    const travellers = visit.visitors
        .flatMap((visitor) => visitor.split(SECOND_VISITOR))
        .flatMap((visitor): TravellerHint[] => {
            const read = readVisitor(visitor);
            return read?.name || read?.categories.length
                ? [
                      {
                          categories:
                              read.title === "Prince" && PRINCIPALITIES.has(code)
                                  ? ["head_of_state"]
                                  : read.categories,
                          countryCode: code,
                          familyName: null,
                          name: read.name,
                          portfolio: null,
                          title: read.title,
                          wikidataId: null,
                      },
                  ]
                : [];
        });
    if (travellers.length === 0) {
        return { reason: "visitor not in office", text: visit.visitors.join("; ") };
    }

    const description = cleanText(visit.description);
    return travellers.map((traveller) => ({
        datePrecision: "day",
        destination,
        endDate: visit.endDate,
        engagements: [],
        eventName: detectEventName([], description),
        purpose: description ? shorten(description, MAX_PURPOSE_LENGTH) : null,
        source: "historian-visits",
        sourceRef: { label: "US Office of the Historian", url: HISTORIAN_VISITS_URL },
        startDate: visit.startDate,
        statusHint: null,
        traveller,
        type: classifyTripType(description),
    }));
};

/**
 * Reads every foreign leader's visit to the United States.
 *
 * @param places - Place index.
 * @returns Claims, and visits that could not be used.
 */
export const extractHistorianVisitClaims = async (
    places: PlaceIndex
): Promise<{ claims: TripClaim[]; skipped: SkippedRow[] }> => {
    const claims: TripClaim[] = [];
    const skipped: SkippedRow[] = [];
    for (const visit of await fetchHistorianVisits()) {
        if (visit.startDate < FIRST_YEAR) {
            continue;
        }
        const result = claimsFromHistorianVisit(visit, places);
        if (Array.isArray(result)) {
            claims.push(...result);
        } else {
            skipped.push(result);
        }
    }
    return { claims, skipped };
};

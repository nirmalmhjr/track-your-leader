import { cleanText } from "../../lib/text";
import {
    CANADA_DATASET_URL,
    type CanadaTravelRow,
    fetchCanadaTravelRows,
} from "../../sources/canada-open-data";
import type { SkippedRow, TripClaim } from "../../types";
import type { CityLookup, PlaceIndex } from "../places.resolve";
import { classifyTitle } from "../roles";
import { classifyTripType, detectEventName } from "../trip-type.classify";
import { placesOf, requestPlaces } from "./free-text-places";
import { shorten } from "./wikipedia.claims";

/**
 * Canadian ministers' international travel from the federal proactive-disclosure dataset. The
 * file covers every institution's senior staff too, so rows are kept by title: ministers (and
 * the Prime Minister) only, not deputy ministers (civil servants) or ministers' staff.
 */

const HOME = "CAN";
const MAX_PURPOSE_LENGTH = 140;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MINISTER = /\bminister\b/i;
const NOT_A_MINISTER =
    /deputy minister|to the minister|minister['’]s|chief of staff|photographer|assistant|advis[eo]r|driver|secretary to|parliamentary secretary|director|press|staff|officer|clerk/i;
/** "Minister" is also a diplomatic rank at embassies ("Minister (Economic)", "Minister-Counsellor"). */
const DIPLOMATIC_RANK =
    /\bminister\s*\(|minister[- ]counsel|head of mission|plenipotentiary|political affairs|embassy|consul|high commission|permanent mission/i;
const FORMER = /^former\s+/i;
const UNTIL = /\s+until\b.*$/i;
const HONOURABLE = /\b(?:the\s+)?(?:hon\.?|honourable|p\.?c\.?|m\.?p\.?)(?=\s|,|$)/gi;
const WHITESPACE = /\s+/g;

/**
 * Whether a row's title belongs to a minister.
 *
 * @param title - `title_en` value.
 * @returns `true` for ministers and the Prime Minister.
 */
export const isMinisterTitle = (title: string): boolean =>
    MINISTER.test(title) && !NOT_A_MINISTER.test(title) && !DIPLOMATIC_RANK.test(title);

/**
 * Puts "Last, First" names in reading order and drops honorifics.
 *
 * @param name - Name as published.
 * @returns The cleaned name.
 */
export const normalizeCanadianName = (name: string): string => {
    const parts = name
        .replace(HONOURABLE, " ")
        .replace(WHITESPACE, " ")
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
    return parts.length === 2 ? `${parts[1]} ${parts[0]}` : parts.join(" ");
};

const officeOf = (row: CanadaTravelRow): string => {
    const title = cleanText(row.title).replace(FORMER, "").replace(UNTIL, "");
    // A bare "Minister" says nothing about the portfolio; the institution does.
    return title.toLowerCase() === "minister" ? `Minister, ${row.organisation}` : title;
};

interface CanadaContext {
    cities: CityLookup;
    places: PlaceIndex;
}

const claimsFromRow = (row: CanadaTravelRow, context: CanadaContext): TripClaim[] | SkippedRow => {
    if (
        !(
            ISO_DATE.test(row.startDate) &&
            ISO_DATE.test(row.endDate) &&
            row.endDate >= row.startDate
        )
    ) {
        return {
            reason: "date not understood",
            text: `${row.name}: ${row.startDate}–${row.endDate}`,
        };
    }
    const destinations = placesOf(row.destinations.join("; "), HOME, context);
    if (destinations.length === 0) {
        return []; // Domestic travel.
    }
    const office = officeOf(row);
    const role = classifyTitle(office);
    const purpose = cleanText(row.purpose);
    return destinations.map((destination) => ({
        datePrecision: "day",
        destination,
        endDate: row.endDate,
        engagements: [],
        eventName: detectEventName([], purpose),
        purpose: purpose ? shorten(purpose, MAX_PURPOSE_LENGTH) : null,
        source: "canada",
        sourceRef: { label: "Government of Canada open data", url: CANADA_DATASET_URL },
        startDate: row.startDate,
        statusHint: null,
        traveller: {
            categories: role.categories.includes("senior_official")
                ? ["minister"]
                : role.categories,
            countryCode: HOME,
            familyName: null,
            name: normalizeCanadianName(row.name),
            portfolio: role.portfolio,
            title: office,
            wikidataId: null,
        },
        type: classifyTripType(purpose),
    }));
};

/**
 * Reads Canadian ministers' international trips.
 *
 * @param context - Place index and city lookup.
 * @returns Claims, and rows that could not be used.
 */
export const extractCanadaClaims = async (
    context: CanadaContext
): Promise<{ claims: TripClaim[]; skipped: SkippedRow[] }> => {
    const rows = await fetchCanadaTravelRows(isMinisterTitle);
    for (const row of rows) {
        requestPlaces(row.destinations.join("; "), HOME, context.cities);
    }
    await context.cities.load();

    const claims: TripClaim[] = [];
    const skipped: SkippedRow[] = [];
    for (const row of rows) {
        const result = claimsFromRow(row, context);
        if (Array.isArray(result)) {
            claims.push(...result);
        } else {
            skipped.push(result);
        }
    }
    return { claims, skipped };
};

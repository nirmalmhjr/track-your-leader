import { getCountryReference } from "@/lib/geo/country-reference";
import type { RoleCategory, TravelType } from "@/types/travel.types";

import { countrySourceFor } from "../../config";
import { COLT_DATASET_URL, type ColtRow, fetchColtRows } from "../../sources/colt";
import type { SkippedRow, TripClaim } from "../../types";
import { type CityLookup, countryPlace, type PlaceIndex } from "../places.resolve";
import { classifyTripType } from "../trip-type.classify";

/** Spreadsheet dates count days from 30 December 1899. */
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86_400_000;
const FIRST_YEAR = 1900;
const LAST_YEAR = 2100;
const EVENT_SEPARATOR = /\s*;\s*/;
const MAX_ENGAGEMENTS = 2;

/** COLT's `LeaderRole`: G(overnment), S(tate), both, or a de facto ruler. IGO leaders are skipped. */
const ROLE_CATEGORIES: Readonly<Record<string, RoleCategory[]>> = {
    // A de facto ruler leads the state too: Syria's al-Sharaa had no prime minister beside him.
    "De Facto": ["head_of_state", "head_of_government"],
    G: ["head_of_government"],
    GS: ["head_of_state", "head_of_government"],
    S: ["head_of_state"],
};

/**
 * Converts a spreadsheet serial date to an ISO date.
 *
 * @param serial - Days since 30 December 1899, as text.
 * @returns The ISO date, or `null` when the cell isn't a date.
 */
export const excelSerialToIso = (serial: string): string | null => {
    const days = Number(serial);
    if (!(Number.isFinite(days) && days > 0)) {
        return null;
    }
    const date = new Date(EXCEL_EPOCH_MS + Math.round(days) * MS_PER_DAY);
    const year = date.getUTCFullYear();
    // Typos in the sheet can produce serials centuries away; those dates are not used.
    return year >= FIRST_YEAR && year <= LAST_YEAR ? date.toISOString().slice(0, 10) : null;
};

const isYes = (value: string): boolean => value.toLowerCase() === "yes";

const engagementsOf = (row: ColtRow): string[] =>
    [
        isYes(row.metHost) && row.hostName ? `Met ${row.hostName}` : null,
        isYes(row.signedAgreement) ? "Signed agreements" : null,
        isYes(row.publicAddress) ? "Gave a public address" : null,
    ]
        .filter((text): text is string => text !== null)
        .slice(0, MAX_ENGAGEMENTS);

/** Exact dates when COLT has them, otherwise the trip's year. */
const datesOf = (
    row: ColtRow
): Pick<TripClaim, "datePrecision" | "endDate" | "startDate"> | null => {
    const startDate = excelSerialToIso(row.startDate);
    if (startDate) {
        const endDate = excelSerialToIso(row.endDate) ?? startDate;
        return endDate >= startDate ? { datePrecision: "day", endDate, startDate } : null;
    }
    const year = Number(row.year);
    return year
        ? { datePrecision: "year", endDate: `${year}-12-31`, startDate: `${year}-01-01` }
        : null;
};

/** Trips to a named event are classified by it; otherwise a meeting with the host is a visit. */
const typeOf = (events: readonly string[], row: ColtRow): TravelType => {
    if (events.length > 0) {
        const type = classifyTripType(events.join(" "));
        return type === "other" ? "multilateral_meeting" : type;
    }
    return isYes(row.metHost) ? "official_visit" : "other";
};

interface ColtContext {
    cities: CityLookup;
    places: PlaceIndex;
}

/**
 * Converts one COLT row.
 *
 * @returns The claim, or why the row was skipped.
 */
export const claimFromColtRow = (
    row: ColtRow,
    { cities, places }: ColtContext
): TripClaim | SkippedRow => {
    const categories = ROLE_CATEGORIES[row.role];
    const home = row.leaderCountry;
    if (!(categories && getCountryReference(home))) {
        return { reason: "not a national leader", text: `${row.fullName} (${row.role}, ${home})` };
    }
    if (row.exiled === "1") {
        return { reason: "leader in exile", text: row.tripId };
    }
    // Commonwealth realms' head of state is the British monarch, tracked under the UK.
    if (!(countrySourceFor(home).includeHeadOfState || categories.includes("head_of_government"))) {
        return { reason: "head of state not tracked", text: row.tripId };
    }

    const dates = datesOf(row);
    if (!dates) {
        return { reason: "date not understood", text: row.tripId };
    }

    const visited = row.visitedCountry;
    const city = row.city ? cities.place(visited, row.city) : null;
    const destination = city ?? countryPlace(places, visited);
    if (!destination || visited === home) {
        return { reason: "destination not found", text: `${row.tripId} → ${visited}` };
    }

    const events = [row.eventName, row.ministerialEventName]
        .flatMap((value) => value.split(EVENT_SEPARATOR))
        .filter(Boolean);
    const [eventName = null] = events;

    return {
        ...dates,
        destination,
        engagements: engagementsOf(row),
        eventName,
        purpose: events.length > 0 ? `Attended ${events.join(" and ")}` : null,
        source: "colt",
        sourceRef: { label: "COLT dataset", url: COLT_DATASET_URL },
        statusHint: null,
        traveller: {
            categories,
            countryCode: home,
            familyName: row.familyName || null,
            name: row.fullName || null,
            portfolio: null,
            title: row.title || null,
            wikidataId: null,
        },
        type: typeOf(events, row),
    };
};

/**
 * Reads COLT and converts every row about a national leader.
 *
 * @param context - Place index and city lookup.
 * @returns Claims, and rows that could not be used.
 */
export const extractColtClaims = async (
    context: ColtContext
): Promise<{ claims: TripClaim[]; skipped: SkippedRow[] }> => {
    const rows = await fetchColtRows();
    for (const row of rows) {
        if (row.city) {
            context.cities.request(row.visitedCountry, row.city);
        }
    }
    await context.cities.load();

    const claims: TripClaim[] = [];
    const skipped: SkippedRow[] = [];
    for (const row of rows) {
        const result = claimFromColtRow(row, context);
        if ("source" in result) {
            claims.push(result);
        } else {
            skipped.push(result);
        }
    }
    return { claims, skipped };
};

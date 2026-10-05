import type { IsoDate } from "@/types/travel.types";

import { mapWithConcurrency } from "../../lib/collections";
import { isoFromParts, isValidDay } from "../../lib/dates";
import { cleanText, formatCiaName } from "../../lib/text";
import { fetchUkCsvRows, fetchUkTravelFiles, type UkTravelFile } from "../../sources/gov-uk";
import type { SkippedRow, TripClaim } from "../../types";
import type { CityLookup, PlaceIndex } from "../places.resolve";
import { classifyTitle } from "../roles";
import { parseTripDates } from "../trip-dates.parse";
import { classifyTripType, detectEventName } from "../trip-type.classify";
import { placesOf, requestPlaces } from "./free-text-places";
import { shorten } from "./wikipedia.claims";

/**
 * UK ministers' overseas travel from GOV.UK transparency CSVs. Layouts changed over the years
 * ("Date of Trip" became "Start Date"/"End Date"), so columns are found by header text.
 */

const HOME = "GBR";
const FILE_CONCURRENCY = 4;
const MAX_PURPOSE_LENGTH = 140;
const CENTURY = 2000;
const TWO_DIGIT_YEAR = 100;

const HEADER = {
    destination: /destination|countr(y|ies) visited|location/i,
    end: /end date/i,
    minister: /^(minister|name)/i,
    purpose: /purpose/i,
    start: /start date|date of (trip|travel|visit)|^dates?$/i,
} as const;
const NIL = /\bnil\b|no (overseas )?travel|nothing to (declare|report)|^none$|^n\/?a$/i;
const ROLE_WORDS =
    /\b(minister|secretary|chancellor|attorney|solicitor general|paymaster|leader of the house|whip|advocate general|lord privy seal|president of the board)\b/i;
const HONORIFICS =
    /\b(?:the\s+)?(?:rt\.?\s+hon\.?|right honourable|hon\.?|mp|qc|kc|obe|cbe|mbe|kbe|dbe|frs|msp|dr\.?|sir|dame)(?=\s|,|$)/gi;
const SPACED_DASH = /^ [-–] $/;
const HAS_HONORIFIC = new RegExp(HONORIFICS.source, "i");
const WHITESPACE = /\s+/g;
const BROKEN_DASH = /�/g;
const NUMERIC_DATE = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;
const SHORT_YEAR_DATE = /^(\d{1,2})[- ]([A-Za-z]{3,})[- ](\d{2})$/;

/** Splits on commas and spaced dashes, but not inside "(Minister for X, Y and Z)". */
const splitOutsideParentheses = (text: string): string[] => {
    const parts: string[] = [];
    let depth = 0;
    let current = "";
    for (const [index, character] of [...text].entries()) {
        depth += character === "(" ? 1 : 0;
        depth -= character === ")" && depth > 0 ? 1 : 0;
        const isDash = SPACED_DASH.test(text.slice(index - 1, index + 2));
        if (depth === 0 && (character === "," || isDash)) {
            parts.push(current);
            current = "";
        } else {
            current += character;
        }
    }
    return [...parts, current];
};

/**
 * Splits a minister cell such as "Secretary of State for Business, Rt Hon Vincent Cable MP"
 * into the person's name and, when given, their office.
 *
 * @param cell - Minister column text.
 * @returns Name (honorifics removed) and title.
 */
export const parseMinisterCell = (cell: string): { name: string; title: string | null } => {
    const parts = splitOutsideParentheses(cell)
        .map((part) => part.trim())
        .filter(Boolean);
    const titleParts = parts.filter((part) => ROLE_WORDS.test(part));
    const nameParts = parts.filter((part) => !ROLE_WORDS.test(part));
    const rawName = nameParts.find((part) => HAS_HONORIFIC.test(part)) ?? nameParts[0] ?? cell;
    return {
        name: formatCiaName(rawName.replace(HONORIFICS, " ").replace(WHITESPACE, " ").trim()),
        title: titleParts.length > 0 ? titleParts.join(", ") : null,
    };
};

const yearOf = (text: string): number => {
    const year = Number(text);
    return year < TWO_DIGIT_YEAR ? CENTURY + year : year;
};

/**
 * Reads one date cell: "11/11/2024" (day first), "2024-11-11", "11-Nov-24", "11 November 2024".
 *
 * @param text - Cell text.
 * @returns The ISO date, or `null`.
 */
export const parseUkDate = (text: string): IsoDate | null => {
    const value = text.trim();
    const iso = value.match(ISO_DATE);
    if (iso) {
        const [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
        return isValidDay(year, month, day) ? isoFromParts(year, month, day) : null;
    }
    const numeric = value.match(NUMERIC_DATE);
    if (numeric) {
        const [day, month, year] = [Number(numeric[1]), Number(numeric[2]), yearOf(numeric[3])];
        return isValidDay(year, month, day) ? isoFromParts(year, month, day) : null;
    }
    const short = value.match(SHORT_YEAR_DATE);
    const expanded = short ? `${short[1]} ${short[2]} ${yearOf(short[3])}` : value;
    const parsed = parseTripDates(expanded, null);
    return parsed && parsed.precision !== "year" ? parsed.startDate : null;
};

type DateRange = Pick<TripClaim, "datePrecision" | "endDate" | "startDate">;

const datesOf = (start: string, end: string | null): DateRange | null => {
    const startDate = parseUkDate(start);
    if (startDate) {
        const endDate = (end && parseUkDate(end)) || startDate;
        return endDate >= startDate ? { datePrecision: "day", endDate, startDate } : null;
    }
    // A single "Date of Trip" cell such as "29 May 2011 – 04 June 2011".
    const range = parseTripDates(start.replace(BROKEN_DASH, "-"), null);
    return range
        ? { datePrecision: range.precision, endDate: range.endDate, startDate: range.startDate }
        : null;
};

interface Columns {
    destination: number;
    end: number;
    minister: number;
    purpose: number;
    start: number;
}

const findHeader = (rows: readonly string[][]): { columns: Columns; index: number } | null => {
    for (const [index, row] of rows.slice(0, 5).entries()) {
        const column = (pattern: RegExp): number => row.findIndex((cell) => pattern.test(cell));
        const columns = {
            destination: column(HEADER.destination),
            end: column(HEADER.end),
            minister: column(HEADER.minister),
            purpose: column(HEADER.purpose),
            start: column(HEADER.start),
        };
        if (columns.destination >= 0 && columns.start >= 0) {
            return { columns, index };
        }
    }
    return null;
};

interface UkContext {
    cities: CityLookup;
    places: PlaceIndex;
}

interface ParsedFile {
    file: UkTravelFile;
    header: { columns: Columns; index: number } | null;
    rows: string[][];
}

interface RowInput {
    cells: Record<keyof Columns, string>;
    file: UkTravelFile;
    minister: string;
}

/** Converts one row (one trip, possibly to several countries). */
const claimsFromRow = (
    { cells, file, minister }: RowInput,
    context: UkContext
): TripClaim[] | SkippedRow => {
    const dates = datesOf(cells.start, cells.end || null);
    if (!dates) {
        return { reason: "date not understood", text: `${cells.start} (${file.csvUrl})` };
    }
    const destinations = placesOf(cells.destination, HOME, context);
    const { name, title } = parseMinisterCell(minister);
    // No foreign country: a trip within the UK, which these files also list.
    if (destinations.length === 0 || !name) {
        return [];
    }
    const office = title ?? `Minister, ${file.department}`;
    const role = classifyTitle(office);
    const { purpose } = cells;
    return destinations.map((destination) => ({
        ...dates,
        destination,
        engagements: [],
        eventName: detectEventName([], purpose),
        purpose: purpose ? shorten(purpose, MAX_PURPOSE_LENGTH) : null,
        source: "gov-uk",
        sourceRef: { label: "GOV.UK transparency data", url: file.publicationUrl },
        statusHint: null,
        traveller: {
            categories: role.categories.includes("senior_official")
                ? ["minister"]
                : role.categories,
            countryCode: HOME,
            familyName: null,
            name,
            portfolio: role.portfolio,
            title: office,
            wikidataId: null,
        },
        type: classifyTripType(purpose),
    }));
};

const isNilRow = (cells: Record<keyof Columns, string>, minister: string): boolean =>
    !(cells.start || cells.destination) ||
    [cells.start, cells.destination, minister].some((value) => NIL.test(value));

const claimsFromFile = (
    { file, header, rows }: ParsedFile,
    context: UkContext,
    skipped: SkippedRow[]
): TripClaim[] => {
    if (!header) {
        skipped.push({ reason: "no date/destination columns", text: file.csvUrl });
        return [];
    }
    const { columns } = header;
    // Some files leave the minister column blank on follow-up rows of the same person.
    let lastMinister = "";
    const claims: TripClaim[] = [];
    for (const row of rows.slice(header.index + 1)) {
        const cell = (index: number): string => (index >= 0 ? cleanText(row[index] ?? "") : "");
        const cells = {
            destination: cell(columns.destination),
            end: cell(columns.end),
            minister: cell(columns.minister),
            purpose: cell(columns.purpose),
            start: cell(columns.start),
        };
        const minister = cells.minister || lastMinister;
        lastMinister = minister;
        if (isNilRow(cells, minister)) {
            continue;
        }
        const result = claimsFromRow({ cells, file, minister }, context);
        if (Array.isArray(result)) {
            claims.push(...result);
        } else {
            skipped.push(result);
        }
    }
    return claims;
};

/**
 * Reads every UK department's ministerial travel CSV.
 *
 * @param context - Place index and city lookup.
 * @returns Claims, and rows that could not be used.
 */
export const extractUkClaims = async (
    context: UkContext
): Promise<{ claims: TripClaim[]; skipped: SkippedRow[] }> => {
    const files = await fetchUkTravelFiles();
    const skipped: SkippedRow[] = [];
    const parsed = await mapWithConcurrency(
        files,
        FILE_CONCURRENCY,
        async (file): Promise<ParsedFile> => {
            try {
                const rows = await fetchUkCsvRows(file.csvUrl);
                return { file, header: findHeader(rows), rows };
            } catch (error) {
                skipped.push({
                    reason: "file unavailable",
                    text: `${file.csvUrl}: ${(error as Error).message}`,
                });
                return { file, header: null, rows: [] };
            }
        }
    );

    for (const { header, rows } of parsed) {
        if (header) {
            for (const row of rows.slice(header.index + 1)) {
                requestPlaces(
                    cleanText(row[header.columns.destination] ?? ""),
                    HOME,
                    context.cities
                );
            }
        }
    }
    await context.cities.load();

    return { claims: parsed.flatMap((file) => claimsFromFile(file, context, skipped)), skipped };
};

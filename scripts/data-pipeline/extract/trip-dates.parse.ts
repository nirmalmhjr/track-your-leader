import type { DatePrecision, IsoDate } from "@/features/travel-explorer/types/travel.types";

import { daysInMonth, isoFromParts, isValidDay } from "../lib/dates";

/**
 * Reads the free-form dates of Wikipedia trip tables:
 * "15–16 June", "30 November – 2 December", "June 15–16, 2014", "December 2019", "2027".
 * When the cell has no year, the year of the section heading is used.
 */

export interface TripDates {
    endDate: IsoDate;
    precision: DatePrecision;
    startDate: IsoDate;
}

const MONTHS: Readonly<Record<string, number>> = {
    apr: 4,
    april: 4,
    aug: 8,
    august: 8,
    dec: 12,
    december: 12,
    feb: 2,
    february: 2,
    jan: 1,
    january: 1,
    jul: 7,
    july: 7,
    jun: 6,
    june: 6,
    mar: 3,
    march: 3,
    may: 5,
    nov: 11,
    november: 11,
    oct: 10,
    october: 10,
    sep: 9,
    sept: 9,
    september: 9,
};
const MONTH = Object.keys(MONTHS)
    .sort((a, b) => b.length - a.length)
    .join("|");

/** "15 June", "15–16 June 2014" */
const DAY_FIRST = new RegExp(
    `(?<!\\d)(\\d{1,2})(?:\\s*–\\s*(\\d{1,2}))?\\s*(${MONTH})\\.?(?:,?\\s+(\\d{4}))?\\b`,
    "gi"
);
/** "June 15", "June 15–16, 2014" */
const MONTH_FIRST = new RegExp(
    `\\b(${MONTH})\\.?\\s+(\\d{1,2})(?!\\d)(?:\\s*–\\s*(\\d{1,2})(?!\\d))?(?:,?\\s+(\\d{4}))?\\b`,
    "gi"
);
/** "June", "June 2027" */
const MONTH_ONLY = new RegExp(`\\b(${MONTH})\\.?(?:\\s+(\\d{4}))?\\b`, "gi");
const YEAR = /\b(?:19|20)\d{2}\b/;

const DASHES = /[‒–—−-]/g;
const RANGE_WORDS = /\s+(?:to|until|and|&)\s+/gi;
const ORDINAL_SUFFIX = /(\d)(?:st|nd|rd|th)\b/gi;
const WEEKDAY = /\b(?:mon|tues|wednes|thurs|fri|satur|sun)day,?\s*/gi;
const SPACED_DASH = /\s*–\s*/g;

interface DatePoint {
    day: number | null;
    dayEnd: number | null;
    month: number;
    year: number | null;
}

const normalize = (text: string): string =>
    text
        .replace(WEEKDAY, "")
        .replace(ORDINAL_SUFFIX, "$1")
        .replace(DASHES, "–")
        .replace(RANGE_WORDS, " – ")
        .replace(SPACED_DASH, " – ");

const toNumber = (value: string | undefined): number | null => (value ? Number(value) : null);

const monthNumber = (value: string): number => MONTHS[value.toLowerCase()] ?? 0;

const readDayFirst = (text: string): DatePoint[] =>
    [...text.matchAll(DAY_FIRST)].map((match) => ({
        day: Number(match[1]),
        dayEnd: toNumber(match[2]),
        month: monthNumber(match[3]),
        year: toNumber(match[4]),
    }));

const readMonthFirst = (text: string): DatePoint[] =>
    [...text.matchAll(MONTH_FIRST)].map((match) => ({
        day: Number(match[2]),
        dayEnd: toNumber(match[3]),
        month: monthNumber(match[1]),
        year: toNumber(match[4]),
    }));

const readMonthsOnly = (text: string): DatePoint[] =>
    [...text.matchAll(MONTH_ONLY)].map((match) => ({
        day: null,
        dayEnd: null,
        month: monthNumber(match[1]),
        year: toNumber(match[2]),
    }));

/** Fills missing years: from the other end of the range, then the section; ranges may cross New Year. */
const resolveYears = (
    first: DatePoint,
    last: DatePoint,
    contextYear: number | null
): [number, number] | null => {
    const startYear = first.year ?? last.year ?? contextYear;
    if (startYear === null) {
        return null;
    }
    const crossesNewYear = last.month < first.month;
    const endYear = last.year ?? (crossesNewYear ? startYear + 1 : startYear);
    // "28 December – 3 January 2020": the explicit year belongs to the end.
    const adjustedStart =
        first.year === null && last.year !== null && crossesNewYear ? last.year - 1 : startYear;
    return [adjustedStart, endYear];
};

const fromDays = (points: DatePoint[], contextYear: number | null): TripDates | null => {
    const [first] = points;
    if (!first) {
        return null;
    }
    const last = points.at(-1) ?? first;
    const years = resolveYears(first, last, contextYear);
    const startDay = first.day;
    const endDay = last.dayEnd ?? last.day;
    if (!years || startDay === null || endDay === null) {
        return null;
    }
    const [startYear, endYear] = years;
    if (
        !(isValidDay(startYear, first.month, startDay) && isValidDay(endYear, last.month, endDay))
    ) {
        return null;
    }
    return {
        endDate: isoFromParts(endYear, last.month, endDay),
        precision: "day",
        startDate: isoFromParts(startYear, first.month, startDay),
    };
};

const fromMonths = (points: DatePoint[], contextYear: number | null): TripDates | null => {
    const [first] = points;
    if (!first) {
        return null;
    }
    const last = points.at(-1) ?? first;
    const years = resolveYears(first, last, contextYear);
    if (!years) {
        return null;
    }
    const [startYear, endYear] = years;
    return {
        endDate: isoFromParts(endYear, last.month, daysInMonth(endYear, last.month)),
        precision: "month",
        startDate: isoFromParts(startYear, first.month, 1),
    };
};

/**
 * Parses a trip's date cell.
 *
 * @param text - Cell text, e.g. "30 November – 2 December".
 * @param contextYear - Year of the enclosing section, used when the cell has none.
 * @returns Start and end dates with their precision, or `null` when the text has no usable date.
 */
export const parseTripDates = (text: string, contextYear: number | null): TripDates | null => {
    const normalized = normalize(text);

    const isOrdered = (dates: TripDates | null): TripDates | null =>
        dates && dates.endDate >= dates.startDate ? dates : null;

    const dayFirst = readDayFirst(normalized);
    const days = dayFirst.length > 0 ? dayFirst : readMonthFirst(normalized);
    if (days.length > 0) {
        return isOrdered(fromDays(days, contextYear));
    }
    const months = readMonthsOnly(normalized);
    if (months.length > 0) {
        return isOrdered(fromMonths(months, contextYear));
    }
    const year = normalized.match(YEAR)?.[0];
    return year
        ? { endDate: `${year}-12-31`, precision: "year", startDate: `${year}-01-01` }
        : null;
};

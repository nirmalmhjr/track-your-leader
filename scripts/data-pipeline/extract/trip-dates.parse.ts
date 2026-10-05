import type { DatePrecision, IsoDate } from "@/types/travel.types";

import { daysInMonth, isoFromParts, isValidDay, persianToIso } from "../lib/dates";

/**
 * Reads the free-form dates of Wikipedia trip tables:
 * "15–16 June", "30 November – 2 December", "June 15–16, 2014", "December 2019", "2027", and
 * their forms on the other Wikipedias read: "del 15 al 17 de junio de 2014", "1er–3 juin
 * 2014", "15 e 16 de janeiro de 2003", "30. März", "8–12 November", "6월 16일", "2024/9/11"
 * and Persian-calendar dates in Persian digits ("۱۴۰۳/۶/۲۱").
 * When the cell has no year, the year of the section heading is used.
 */

export interface TripDates {
    endDate: IsoDate;
    precision: DatePrecision;
    startDate: IsoDate;
}

const MONTHS: Readonly<Record<string, number>> = {
    // Spanish
    abril: 4,
    agosto: 8,
    // Indonesian
    agustus: 8,
    aout: 8,
    // French
    août: 8,
    // English
    apr: 4,
    april: 4,
    aug: 8,
    august: 8,
    avr: 4,
    avril: 4,
    dec: 12,
    december: 12,
    decembre: 12,
    desember: 12,
    // German
    dez: 12,
    dezember: 12,
    // Portuguese
    dezembro: 12,
    diciembre: 12,
    déc: 12,
    décembre: 12,
    enero: 1,
    feb: 2,
    febrero: 2,
    februar: 2,
    februari: 2,
    february: 2,
    fevereiro: 2,
    fevr: 2,
    fevrier: 2,
    févr: 2,
    février: 2,
    jan: 1,
    janeiro: 1,
    januar: 1,
    januari: 1,
    january: 1,
    janv: 1,
    janvier: 1,
    juil: 7,
    juillet: 7,
    juin: 6,
    jul: 7,
    julho: 7,
    juli: 7,
    julio: 7,
    july: 7,
    jun: 6,
    june: 6,
    junho: 6,
    juni: 6,
    junio: 6,
    jänner: 1,
    maerz: 3,
    mai: 5,
    maio: 5,
    mar: 3,
    march: 3,
    marco: 3,
    maret: 3,
    mars: 3,
    marzo: 3,
    março: 3,
    may: 5,
    mayo: 5,
    mei: 5,
    mär: 3,
    märz: 3,
    nov: 11,
    november: 11,
    novembre: 11,
    noviembre: 11,
    oct: 10,
    october: 10,
    octobre: 10,
    octubre: 10,
    okt: 10,
    oktober: 10,
    outubro: 10,
    sep: 9,
    sept: 9,
    september: 9,
    septembre: 9,
    septiembre: 9,
    setembro: 9,
    setiembre: 9,
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
/**
 * "to", "and"; Spanish "al", "y", "hasta"; French "au", "et"; Portuguese "a", "e", "até";
 * German "bis", "und"; Indonesian "hingga", "sampai", "dan".
 */
const RANGE_WORDS =
    /\s+(?:to|until|and|&|al|y|hasta|au|et|a|e|até|bis|und|hingga|sampai|dan)\s+|\s*~\s*/gi;
/** German "30. März": the day's full stop goes. */
const DAY_FULL_STOP = /(\d{1,2})\.(?=\s*[‒–—−-]|\s*[A-Za-zÄÖÜäöü])/g;
/** Persian and Arabic-Indic digits. */
const EASTERN_DIGIT = /[۰-۹٠-٩]/g;
/** "2024/9/11"; years before 1700 are Persian-calendar years ("1403/6/21"). */
const NUMERIC_DATE = /\b(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})\b/g;
/** "2025년 6월 16일", "6월 16일" */
const KOREAN_DAY = /(?:(\d{4})년\s*)?(\d{1,2})월\s*(\d{1,2})일/g;
/** "2025년 6월" */
const KOREAN_MONTH = /(\d{4})년\s*(\d{1,2})월/g;
const EARLIEST_GREGORIAN_YEAR = 1700;
const MONTH_NAMES = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
] as const;
/** "1st", "1er", "1º". */
const ORDINAL_SUFFIX = /(\d)(?:(?:st|nd|rd|th|er)\b|[º°])/gi;
/** Spanish "15 de junio de 2014" reads as "15 junio 2014". */
const DAY_DE = /(\d)\s+de\s+/gi;
const MONTH_DE_YEAR = new RegExp(`(${MONTH})\\s+del?\\s+(\\d{4})`, "gi");
const WEEKDAY = /\b(?:mon|tues|wednes|thurs|fri|satur|sun)day,?\s*/gi;
const SPACED_DASH = /\s*–\s*/g;

interface DatePoint {
    day: number | null;
    dayEnd: number | null;
    month: number;
    year: number | null;
}

const westernDigit = (digit: string): string => {
    const code = digit.charCodeAt(0);
    // Persian ۰ is U+06F0, Arabic-Indic ٠ is U+0660.
    return String(code >= 0x06_f0 ? code - 0x06_f0 : code - 0x06_60);
};

const monthName = (month: number): string => MONTH_NAMES[month - 1] ?? "";

/** Numeric and Korean dates become "16 june 2025", which the rest of the parser reads. */
const spellOut = (text: string): string =>
    text
        .replace(EASTERN_DIGIT, westernDigit)
        .replace(NUMERIC_DATE, (match, year: string, month: string, day: string) => {
            const [y, m, d] = [Number(year), Number(month), Number(day)];
            if (y < EARLIEST_GREGORIAN_YEAR) {
                const iso = persianToIso(y, m, d);
                return iso
                    ? `${Number(iso.slice(8))} ${monthName(Number(iso.slice(5, 7)))} ${iso.slice(0, 4)}`
                    : match;
            }
            return isValidDay(y, m, d) ? `${d} ${monthName(m)} ${y}` : match;
        })
        .replace(
            KOREAN_DAY,
            (_, year: string | undefined, month: string, day: string) =>
                `${Number(day)} ${monthName(Number(month))}${year ? ` ${year}` : ""}`
        )
        .replace(
            KOREAN_MONTH,
            (_, year: string, month: string) => `${monthName(Number(month))} ${year}`
        );

const normalize = (text: string): string =>
    spellOut(text)
        .replace(DAY_FULL_STOP, "$1")
        .replace(WEEKDAY, "")
        .replace(ORDINAL_SUFFIX, "$1")
        .replace(DAY_DE, "$1 ")
        .replace(MONTH_DE_YEAR, "$1 $2")
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

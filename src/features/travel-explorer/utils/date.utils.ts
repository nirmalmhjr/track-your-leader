import type { IsoDate } from "@/features/travel-explorer/types/travel.types";

const MS_PER_DAY = 86_400_000;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const pad = (value: number): string => String(value).padStart(2, "0");

/**
 * Converts a date to an ISO calendar date using the viewer's local calendar day.
 *
 * @param date - Date to convert.
 * @returns The date formatted as `YYYY-MM-DD`.
 */
export const toIsoDate = (date: Date): IsoDate =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/**
 * Parses an ISO calendar date as UTC midnight so arithmetic is unaffected by time zones.
 *
 * @param value - Date formatted as `YYYY-MM-DD`.
 * @returns A `Date` at 00:00 UTC on that day.
 */
export const parseIsoDate = (value: IsoDate): Date => {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
};

/**
 * Checks whether a string is a well-formed ISO calendar date.
 *
 * @param value - Candidate string.
 * @returns `true` when the value matches `YYYY-MM-DD` and is a real calendar day.
 */
export const isIsoDate = (value: string): value is IsoDate => {
    if (!ISO_DATE_PATTERN.test(value)) {
        return false;
    }

    const parsed = parseIsoDate(value);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
};

/**
 * Adds whole days to an ISO calendar date.
 *
 * @param value - Starting date.
 * @param days - Number of days to add; negative values subtract.
 * @returns The shifted ISO date.
 */
export const addDays = (value: IsoDate, days: number): IsoDate => {
    const shifted = new Date(parseIsoDate(value).getTime() + days * MS_PER_DAY);
    return shifted.toISOString().slice(0, 10);
};

/**
 * Adds calendar months to an ISO date, clamping to the end of shorter months.
 *
 * @param value - Starting date.
 * @param months - Number of months to add; negative values subtract.
 * @returns The shifted ISO date.
 */
export const addMonths = (value: IsoDate, months: number): IsoDate => {
    const date = parseIsoDate(value);
    const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
    const lastDay = new Date(
        Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
    ).getUTCDate();
    target.setUTCDate(Math.min(date.getUTCDate(), lastDay));
    return target.toISOString().slice(0, 10);
};

/**
 * Counts calendar days in an inclusive date range.
 *
 * @param start - First day.
 * @param end - Last day.
 * @returns Number of days, where a same-day trip counts as one.
 */
export const countDaysInclusive = (start: IsoDate, end: IsoDate): number =>
    Math.round((parseIsoDate(end).getTime() - parseIsoDate(start).getTime()) / MS_PER_DAY) + 1;

/**
 * Returns the first and last day of a calendar month or year.
 *
 * @param year - Four-digit year.
 * @param month - Zero-based month, or `null` for the whole year.
 * @returns Inclusive start and end dates.
 */
export const getCalendarRange = (
    year: number,
    month: number | null
): { from: IsoDate; to: IsoDate } => {
    if (month === null) {
        return { from: `${year}-01-01`, to: `${year}-12-31` };
    }

    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return {
        from: `${year}-${pad(month + 1)}-01`,
        to: `${year}-${pad(month + 1)}-${pad(lastDay)}`,
    };
};

/**
 * Checks whether two inclusive date ranges overlap. Open-ended bounds are treated as unbounded.
 *
 * @param start - Start of the first range.
 * @param end - End of the first range.
 * @param from - Start of the second range, or `null` for no lower bound.
 * @param to - End of the second range, or `null` for no upper bound.
 * @returns `true` when the ranges share at least one day.
 */
export const rangesOverlap = (
    start: IsoDate,
    end: IsoDate,
    from: IsoDate | null,
    to: IsoDate | null
): boolean => (from === null || end >= from) && (to === null || start <= to);

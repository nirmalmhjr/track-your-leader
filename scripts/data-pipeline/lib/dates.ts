import type { IsoDate } from "@/features/travel-explorer/types/travel.types";

const pad = (value: number): string => String(value).padStart(2, "0");

/**
 * Formats calendar parts as an ISO date.
 *
 * @param year - Full year.
 * @param month - Month, 1–12.
 * @param day - Day of month.
 * @returns `YYYY-MM-DD`.
 */
export const isoFromParts = (year: number, month: number, day: number): IsoDate =>
    `${year}-${pad(month)}-${pad(day)}`;

/**
 * Number of days in a month.
 *
 * @param year - Full year.
 * @param month - Month, 1–12.
 * @returns 28–31.
 */
export const daysInMonth = (year: number, month: number): number =>
    new Date(Date.UTC(year, month, 0)).getUTCDate();

/**
 * Checks that calendar parts form a real date (rejects 31 April).
 *
 * @returns `true` for valid dates.
 */
export const isValidDay = (year: number, month: number, day: number): boolean =>
    month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);

/** Today's date in UTC, the pipeline's reference day. */
export const todayIso = (): IsoDate => new Date().toISOString().slice(0, 10);

/**
 * Shifts an ISO date by whole days.
 *
 * @param value - Starting date.
 * @param days - Days to add (negative to subtract).
 * @returns The shifted date.
 */
export const addDaysIso = (value: IsoDate, days: number): IsoDate => {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
};

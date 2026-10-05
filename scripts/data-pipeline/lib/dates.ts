import type { IsoDate } from "@/types/travel.types";

const pad = (value: number): string => String(value).padStart(2, "0");
/** Four-digit years keep ISO dates sortable as text, including medieval ones ("0947"). */
const YEAR_DIGITS = 4;

/**
 * Formats calendar parts as an ISO date.
 *
 * @param year - Full year.
 * @param month - Month, 1–12.
 * @param day - Day of month.
 * @returns `YYYY-MM-DD`.
 */
export const isoFromParts = (year: number, month: number, day: number): IsoDate =>
    `${String(year).padStart(YEAR_DIGITS, "0")}-${pad(month)}-${pad(day)}`;

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

// --- Solar Hijri (Persian) calendar -------------------------------------------------------

/** Years where the Persian calendar's 33-year leap cycle shifts (the jalaali algorithm). */
const JALALI_BREAKS = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394,
    2456, 3178,
] as const;
const LAST_JALALI_BREAK = JALALI_BREAKS.at(-1) ?? 0;
const CYCLE_YEARS = 33;
const LEAPS_PER_CYCLE = 8;
const JALALI_EPOCH_OFFSET = 621;

const div = (a: number, b: number): number => Math.trunc(a / b);
const mod = (a: number, b: number): number => a - Math.trunc(a / b) * b;

/** Day number of a Gregorian date. */
const gregorianToDay = (year: number, month: number, day: number): number => {
    const days =
        div((year + div(month - 8, 6) + 100_100) * 1461, 4) +
        div(153 * mod(month + 9, 12) + 2, 5) +
        day -
        34_840_408;
    return days - div(div(year + 100_100 + div(month - 8, 6), 100) * 3, 4) + 752;
};

/** Gregorian date of a day number. */
const dayToGregorian = (dayNumber: number): [number, number, number] => {
    let j = 4 * dayNumber + 139_361_631;
    j += div(div(4 * dayNumber + 183_187_720, 146_097) * 3, 4) * 4 - 3908;
    const i = div(mod(j, 1461), 4) * 5 + 308;
    const day = div(mod(i, 153), 5) + 1;
    const month = mod(div(i, 153), 12) + 1;
    const year = div(j, 1461) - 100_100 + div(8 - month, 6);
    return [year, month, day];
};

/** Gregorian year in which a Persian year starts, and the March day of its New Year. */
const persianNewYear = (persianYear: number): { gregorianYear: number; march: number } => {
    const gregorianYear = persianYear + JALALI_EPOCH_OFFSET;
    let leaps = -14;
    let previous: number = JALALI_BREAKS[0];
    let jump = 0;
    for (const next of JALALI_BREAKS.slice(1)) {
        jump = next - previous;
        if (persianYear < next) {
            break;
        }
        leaps += div(jump, CYCLE_YEARS) * LEAPS_PER_CYCLE + div(mod(jump, CYCLE_YEARS), 4);
        previous = next;
    }
    const sinceBreak = persianYear - previous;
    leaps +=
        div(sinceBreak, CYCLE_YEARS) * LEAPS_PER_CYCLE + div(mod(sinceBreak, CYCLE_YEARS) + 3, 4);
    if (mod(jump, CYCLE_YEARS) === 4 && jump - sinceBreak === 4) {
        leaps += 1;
    }
    const gregorianLeaps = div(gregorianYear, 4) - div((div(gregorianYear, 100) + 1) * 3, 4) - 150;
    return { gregorianYear, march: 20 + leaps - gregorianLeaps };
};

/**
 * Converts a Solar Hijri date, as used in Iran and Afghanistan ("1403/6/21"), to ISO.
 *
 * @param year - Persian year.
 * @param month - Persian month, 1–12.
 * @param day - Day of the month.
 * @returns The Gregorian date, or `null` outside the calendar's range or for impossible days.
 */
export const persianToIso = (year: number, month: number, day: number): IsoDate | null => {
    const lastMonthDays = 29;
    const isValid =
        year > JALALI_BREAKS[0] &&
        year < LAST_JALALI_BREAK &&
        month >= 1 &&
        month <= 12 &&
        day >= 1 &&
        day <= (month <= 6 ? 31 : 30) &&
        !(month === 12 && day > lastMonthDays + 1);
    if (!isValid) {
        return null;
    }
    const { gregorianYear, march } = persianNewYear(year);
    const dayNumber =
        gregorianToDay(gregorianYear, 3, march) +
        (month - 1) * 31 -
        div(month, 7) * (month - 7) +
        day -
        1;
    const [gy, gm, gd] = dayToGregorian(dayNumber);
    return isoFromParts(gy, gm, gd);
};

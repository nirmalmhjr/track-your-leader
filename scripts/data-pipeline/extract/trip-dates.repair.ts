/**
 * Repairs a mistyped year in a trip's dates. Ministerial transparency tables now and then carry a
 * slip in one year ("21–25 August 2107", or an end typed a year after the start), which turns a
 * few days abroad into a stay of years. When giving one date the other's year, or the year next
 * to it, makes a short trip, that reading is used.
 */
import type { DatePrecision, IsoDate } from "@/types/travel.types";

import { isoFromParts, isValidDay } from "../lib/dates";

/** Longest trip a repaired reading may describe. */
export const MAX_REPAIRED_TRIP_DAYS = 31;
/** Shortest span suspected of a mistyped year: a slip in the year is at least ~11 months off. */
const MIN_SUSPECT_DAYS = 300;
const MS_PER_DAY = 86_400_000;

/** When the official was in office, if known; trips inside it are the likelier reading. */
export interface Career {
    from: IsoDate;
    to: IsoDate;
}

interface DatedTrip {
    datePrecision: DatePrecision;
    endDate: IsoDate;
    startDate: IsoDate;
}

const spanDays = (start: IsoDate, end: IsoDate): number =>
    Math.round((Date.parse(end) - Date.parse(start)) / MS_PER_DAY);

/** The date in another year, or `null` when that day doesn't exist then (29 February). */
const inYear = (date: IsoDate, year: number): IsoDate | null => {
    const [, month, day] = date.split("-").map(Number);
    return isValidDay(year, month, day) ? isoFromParts(year, month, day) : null;
};

/**
 * Span of an official's offices, open-ended offices running to today.
 *
 * @param positions - The official's offices.
 * @param today - Today's date.
 * @returns The span, or `null` when no office has a start date.
 */
export const careerOf = (
    positions: readonly { endDate: IsoDate | null; startDate: IsoDate | null }[],
    today: IsoDate
): Career | null => {
    const starts = positions.flatMap((position) => position.startDate ?? []).sort();
    if (starts.length === 0) {
        return null;
    }
    const ends = positions.map((position) => position.endDate ?? today).sort();
    return { from: starts[0], to: ends.at(-1) ?? today };
};

/**
 * Reads a trip that lasts years as one with a mistyped year, when another year makes it short.
 * Readings are tried keeping the start (the end in the start's year, then the next), then keeping
 * the end; one inside the official's career wins over one outside it.
 *
 * @param trip - Trip or claim to check.
 * @param career - When the official was in office, if known.
 * @returns The trip with repaired dates, or the same trip when nothing needs or allows repair.
 */
export const repairYearTypo = <T extends DatedTrip>(trip: T, career: Career | null): T => {
    const { datePrecision, endDate, startDate } = trip;
    if (datePrecision !== "day" || spanDays(startDate, endDate) < MIN_SUSPECT_DAYS) {
        return trip;
    }
    const startYear = Number(startDate.slice(0, 4));
    const endYear = Number(endDate.slice(0, 4));
    const readings = [
        { endDate: inYear(endDate, startYear), startDate },
        { endDate: inYear(endDate, startYear + 1), startDate },
        { endDate, startDate: inYear(startDate, endYear) },
        { endDate, startDate: inYear(startDate, endYear - 1) },
    ].flatMap((reading) => {
        if (!(reading.startDate && reading.endDate)) {
            return [];
        }
        const days = spanDays(reading.startDate, reading.endDate);
        return days >= 0 && days <= MAX_REPAIRED_TRIP_DAYS
            ? [{ endDate: reading.endDate, startDate: reading.startDate }]
            : [];
    });
    const isInCareer = (reading: { endDate: IsoDate; startDate: IsoDate }) =>
        career !== null && reading.startDate >= career.from && reading.endDate <= career.to;
    const best = readings.find(isInCareer) ?? readings[0];
    return best ? { ...trip, ...best } : trip;
};

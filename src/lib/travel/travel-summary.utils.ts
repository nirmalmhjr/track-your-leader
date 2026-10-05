import { countDaysInclusive } from "@/lib/travel/date.utils";
import { FUTURE_STATUSES } from "@/lib/travel/travel.constants";
import type { IsoDate, TravelRecord, TravelStatus, TravelSummary } from "@/types/travel.types";

/**
 * Whether a status describes a trip that has not happened yet.
 *
 * @param status - Trip status.
 * @returns `true` for upcoming and planned trips.
 */
export const isFutureStatus = (status: TravelStatus): boolean => FUTURE_STATUSES.includes(status);

/**
 * Whether a scheduled trip is happening today.
 *
 * @param record - Trip to check.
 * @param today - Reference date.
 * @returns `true` when today falls within the trip's dates and it has not been cancelled.
 */
export const isTripInProgress = (record: TravelRecord, today: IsoDate): boolean =>
    isFutureStatus(record.status) && record.startDate <= today && today <= record.endDate;

/**
 * Builds headline numbers for a set of trips. Cancelled trips are excluded from every count.
 *
 * @param records - Trips to summarise, in any order.
 * @returns Trip, country, day and upcoming counts plus the latest and next trips.
 */
export const summarizeTravel = (records: readonly TravelRecord[]): TravelSummary => {
    let daysAbroad = 0;
    let upcomingCount = 0;
    let lastTrip: TravelRecord | null = null;
    let nextTrip: TravelRecord | null = null;
    const countries = new Set<string>();
    let tripCount = 0;

    for (const record of records) {
        if (record.status === "cancelled") {
            continue;
        }

        tripCount += 1;
        countries.add(record.destination.countryCode);

        if (record.status === "completed") {
            // Loosely dated trips ("June 2027") have no real length, so they add no days.
            if (record.datePrecision === "day") {
                daysAbroad += countDaysInclusive(record.startDate, record.endDate);
            }
            if (!lastTrip || record.startDate > lastTrip.startDate) {
                lastTrip = record;
            }
            continue;
        }

        upcomingCount += 1;
        if (!nextTrip || record.startDate < nextTrip.startDate) {
            nextTrip = record;
        }
    }

    return {
        countryCount: countries.size,
        daysAbroad,
        lastTrip,
        nextTrip,
        tripCount,
        upcomingCount,
    };
};

/**
 * Splits trips into calendar-year buckets, preserving the incoming order.
 *
 * @param records - Trips sorted in display order.
 * @returns Year buckets in the order they first appear.
 */
export const groupByYear = (
    records: readonly TravelRecord[]
): { year: string; records: TravelRecord[] }[] => {
    const groups: { year: string; records: TravelRecord[] }[] = [];

    for (const record of records) {
        const year = record.startDate.slice(0, 4);
        const current = groups.at(-1);
        if (current?.year === year) {
            current.records.push(record);
        } else {
            groups.push({ records: [record], year });
        }
    }

    return groups;
};

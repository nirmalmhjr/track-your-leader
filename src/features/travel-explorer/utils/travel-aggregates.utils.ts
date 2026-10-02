import {
    FUTURE_STATUSES,
    SEQUENTIAL_STEPS,
} from "@/features/travel-explorer/constants/explorer.constants";
import type {
    DestinationAggregate,
    RouteAggregate,
    SequentialScale,
    TravelSummary,
} from "@/features/travel-explorer/types/explorer.types";
import type {
    IsoDate,
    TravelRecord,
    TravelStatus,
} from "@/features/travel-explorer/types/travel.types";
import { countDaysInclusive } from "@/features/travel-explorer/utils/date.utils";

const STATUS_PRIORITY: readonly TravelStatus[] = ["completed", "upcoming", "planned", "cancelled"];

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
            daysAbroad += countDaysInclusive(record.startDate, record.endDate);
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
 * Groups trips by destination city so each city is drawn once on the map.
 *
 * @param records - Trips to group.
 * @returns One aggregate per destination city, busiest first.
 */
export const aggregateByDestination = (
    records: readonly TravelRecord[]
): DestinationAggregate[] => {
    const groups = new Map<string, TravelRecord[]>();

    for (const record of records) {
        const key = `${record.destination.countryCode}:${record.destination.city}`;
        const group = groups.get(key) ?? [];
        group.push(record);
        groups.set(key, group);
    }

    return [...groups.entries()]
        .map(([key, group]) => {
            const sorted = [...group].sort((a, b) => b.startDate.localeCompare(a.startDate));
            return {
                hasFuture: group.some((record) => isFutureStatus(record.status)),
                hasPast: group.some((record) => record.status === "completed"),
                key,
                latest: sorted[0],
                onlyCancelled: group.every((record) => record.status === "cancelled"),
                place: sorted[0].destination,
                records: sorted,
            };
        })
        .sort((a, b) => b.records.length - a.records.length);
};

/**
 * Groups trips by origin and destination city pair.
 *
 * @param records - Trips to group.
 * @returns One aggregate per route with the most significant status first.
 */
export const aggregateRoutes = (records: readonly TravelRecord[]): RouteAggregate[] => {
    const groups = new Map<string, TravelRecord[]>();

    for (const record of records) {
        const key = `${record.origin.city}>${record.destination.city}:${record.destination.countryCode}`;
        const group = groups.get(key) ?? [];
        group.push(record);
        groups.set(key, group);
    }

    return [...groups.entries()].map(([key, group]) => ({
        dominantStatus:
            STATUS_PRIORITY.find((status) => group.some((record) => record.status === status)) ??
            "completed",
        from: group[0].origin,
        key,
        records: group,
        to: group[0].destination,
    }));
};

/**
 * Counts non-cancelled trips per key.
 *
 * @param records - Trips to count.
 * @param getKey - Extracts the grouping key from a trip.
 * @returns Map of key to trip count.
 */
export const countTrips = (
    records: readonly TravelRecord[],
    getKey: (record: TravelRecord) => string
): Map<string, number> => {
    const counts = new Map<string, number>();

    for (const record of records) {
        if (record.status === "cancelled") {
            continue;
        }
        const key = getKey(record);
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return counts;
};

/**
 * Builds a quantised sequential scale with "nice" integer thresholds for map shading.
 *
 * @param maxValue - Largest value to be shaded.
 * @returns Thresholds and a lookup from value to step index (`-1` for zero).
 */
export const buildSequentialScale = (maxValue: number): SequentialScale => {
    const thresholds =
        maxValue <= SEQUENTIAL_STEPS
            ? Array.from({ length: Math.max(maxValue, 1) }, (_, index) => index + 1)
            : [
                  ...new Set(
                      Array.from({ length: SEQUENTIAL_STEPS }, (_, index) =>
                          Math.ceil((maxValue * (index + 1)) / SEQUENTIAL_STEPS)
                      )
                  ),
              ];

    return {
        stepFor: (value) => {
            if (value <= 0) {
                return -1;
            }
            const index = thresholds.findIndex((threshold) => value <= threshold);
            const step = index === -1 ? thresholds.length - 1 : index;
            // Spread steps across the full ramp when there are fewer thresholds than colours.
            return Math.round((step / Math.max(thresholds.length - 1, 1)) * (SEQUENTIAL_STEPS - 1));
        },
        thresholds,
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

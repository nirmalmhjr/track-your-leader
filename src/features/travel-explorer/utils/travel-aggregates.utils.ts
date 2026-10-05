import { SEQUENTIAL_STEPS } from "@/features/travel-explorer/constants/explorer.constants";
import type {
    DestinationAggregate,
    RouteAggregate,
    SequentialScale,
} from "@/features/travel-explorer/types/explorer.types";
import { isFutureStatus } from "@/lib/travel/travel-summary.utils";
import type { TravelRecord, TravelStatus } from "@/types/travel.types";

const STATUS_PRIORITY: readonly TravelStatus[] = ["completed", "upcoming", "planned", "cancelled"];

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

import type { ExplorerFilters, WorldStats } from "@/features/travel-explorer/types/explorer.types";
import {
    createTravelMatcher,
    matchesOfficialFilters,
} from "@/features/travel-explorer/utils/filters.utils";
import { countTrips } from "@/features/travel-explorer/utils/travel-aggregates.utils";
import { FUTURE_STATUSES } from "@/lib/travel/travel.constants";
import type { CountryCode } from "@/types/geo.types";
import type { Official, TravelRecord, TravelStatus } from "@/types/travel.types";

interface WorldStatsInput {
    matchingOfficialCount: number;
    /** Trips passing every filter. */
    matchingRecords: readonly TravelRecord[];
    officialsByCountry: ReadonlyMap<CountryCode, readonly Official[]>;
}

/**
 * Sums up the filtered trips for the world view: the map's shading, the scope summary, the
 * overview's stats and country list, and the hover tooltip all read these numbers.
 *
 * @param input - Filtered trips and officials.
 * @returns The world view's numbers.
 */
export const computeWorldStats = ({
    matchingOfficialCount,
    matchingRecords,
    officialsByCountry,
}: WorldStatsInput): WorldStats => {
    const tripsByStatus: Record<TravelStatus, number> = {
        cancelled: 0,
        completed: 0,
        planned: 0,
        upcoming: 0,
    };
    for (const record of matchingRecords) {
        tripsByStatus[record.status] += 1;
    }

    return {
        officialCount: matchingOfficialCount,
        officialsByCountry: new Map(
            [...officialsByCountry].map(([code, officials]) => [code, officials.length])
        ),
        tripCount: matchingRecords.length - tripsByStatus.cancelled,
        tripsByOrigin: countTrips(matchingRecords, (record) => record.originCountryCode),
        tripsByStatus,
        upcomingCount: FUTURE_STATUSES.reduce((total, status) => total + tripsByStatus[status], 0),
        visitsByDestination: countTrips(
            matchingRecords,
            (record) => record.destination.countryCode
        ),
    };
};

/**
 * Applies the filters to everyone and every trip, as the explorer does at world level (where no
 * trips are exempt from the date range).
 *
 * @param officials - Every official.
 * @param records - Every trip.
 * @param filters - Filters to apply.
 * @returns The officials and trips passing them.
 */
export const matchWorldTravel = (
    officials: readonly Official[],
    records: readonly TravelRecord[],
    filters: ExplorerFilters
): { matchingOfficialCount: number; matchingRecords: TravelRecord[] } => {
    const matchingOfficialIds = new Set(
        officials
            .filter((official) => matchesOfficialFilters(official, filters))
            .map((official) => official.id)
    );
    const matchesTravel = createTravelMatcher(filters, { kind: "none" });
    return {
        matchingOfficialCount: matchingOfficialIds.size,
        matchingRecords: records.filter(
            (record) => matchingOfficialIds.has(record.officialId) && matchesTravel(record)
        ),
    };
};

import type {
    GeneratedOfficial,
    GeneratedTrip,
} from "@/features/travel-explorer/data/generated-data.schema";
import { TRACKED_COUNTRIES } from "@/features/travel-explorer/data/tracked-countries";

import type { WarehouseOfficial } from "../lib/warehouse";

/**
 * The app still bundles its data, so it receives a slice of the warehouse: the tracked
 * countries, officials in office (or travelling) since `sinceYear`, and their trips since then.
 */

export interface AppExport {
    officials: GeneratedOfficial[];
    trips: GeneratedTrip[];
}

const servedSince = (official: WarehouseOfficial, since: string): boolean =>
    official.positions.some((position) => position.endDate === null || position.endDate >= since);

/**
 * Selects what the app shows from the warehouse.
 *
 * @param officials - Warehouse officials per country.
 * @param trips - Warehouse trips per country.
 * @param sinceYear - First year the app covers.
 * @returns Officials and trips for the app's files.
 */
export const buildAppExport = (
    officials: ReadonlyMap<string, readonly WarehouseOfficial[]>,
    trips: ReadonlyMap<string, readonly GeneratedTrip[]>,
    sinceYear: number
): AppExport => {
    const since = `${sinceYear}-01-01`;
    const exportedTrips: GeneratedTrip[] = [];
    const exportedOfficials: GeneratedOfficial[] = [];

    for (const { code } of TRACKED_COUNTRIES) {
        const recentTrips = (trips.get(code) ?? []).filter((trip) => trip.startDate >= since);
        const travellers = new Set(recentTrips.map((trip) => trip.officialId));
        const kept = (officials.get(code) ?? []).filter(
            (official) => travellers.has(official.id) || servedSince(official, since)
        );
        const keptIds = new Set(kept.map((official) => official.id));
        exportedOfficials.push(...kept.map(({ aliases: _aliases, ...official }) => official));
        exportedTrips.push(...recentTrips.filter((trip) => keptIds.has(trip.officialId)));
    }

    return {
        officials: exportedOfficials,
        trips: exportedTrips.sort((a, b) => a.id.localeCompare(b.id)),
    };
};

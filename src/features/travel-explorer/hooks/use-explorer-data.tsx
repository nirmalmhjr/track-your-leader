"use client";

import { createContext, type ReactNode, use, useMemo } from "react";

import { TRAVEL_DATASET } from "@/features/travel-explorer/data/travel-dataset";
import { useExplorerState } from "@/features/travel-explorer/hooks/use-explorer-state";
import type {
    IsoDate,
    Official,
    TrackedCountry,
    TravelRecord,
} from "@/features/travel-explorer/types/travel.types";
import { toIsoDate } from "@/features/travel-explorer/utils/date.utils";
import {
    hasTravelFilters,
    matchesOfficialFilters,
    matchesTravelFilters,
} from "@/features/travel-explorer/utils/filters.utils";
import type { CountryCode } from "@/types/geo.types";

const groupRecords = (
    records: readonly TravelRecord[],
    getKey: (record: TravelRecord) => string
): Map<string, TravelRecord[]> => {
    const groups = new Map<string, TravelRecord[]>();
    for (const record of records) {
        const key = getKey(record);
        const group = groups.get(key);
        if (group) {
            group.push(record);
        } else {
            groups.set(key, [record]);
        }
    }
    return groups;
};

const countryByCode = new Map(TRAVEL_DATASET.countries.map((country) => [country.code, country]));
const officialById = new Map(TRAVEL_DATASET.officials.map((official) => [official.id, official]));
const recordById = new Map(TRAVEL_DATASET.records.map((record) => [record.id, record]));
const officialsByCountry = new Map<CountryCode, Official[]>();
for (const official of TRAVEL_DATASET.officials) {
    const list = officialsByCountry.get(official.countryCode);
    if (list) {
        list.push(official);
    } else {
        officialsByCountry.set(official.countryCode, [official]);
    }
}

interface ExplorerData {
    /** All officials, ignoring filters (used by search). */
    allOfficials: readonly Official[];
    countries: readonly TrackedCountry[];
    countryByCode: ReadonlyMap<CountryCode, TrackedCountry>;
    /** Officials passing the person-level filters. */
    matchingOfficialIds: ReadonlySet<string>;
    /** Trips passing every filter, newest first. */
    matchingRecords: readonly TravelRecord[];
    officialById: ReadonlyMap<string, Official>;
    officialsByCountry: ReadonlyMap<CountryCode, readonly Official[]>;
    recordById: ReadonlyMap<string, TravelRecord>;
    recordsByDestination: ReadonlyMap<CountryCode, readonly TravelRecord[]>;
    recordsByOfficial: ReadonlyMap<string, readonly TravelRecord[]>;
    recordsByOrigin: ReadonlyMap<CountryCode, readonly TravelRecord[]>;
    today: IsoDate;
    /** Whether trip-level filters are narrowing results. */
    travelFiltersActive: boolean;
}

const ExplorerDataContext = createContext<ExplorerData | null>(null);

/**
 * Applies the current filters to the travel dataset once and shares the indexed results with
 * the map and the panel, so both always describe the same slice of data.
 */
export function ExplorerDataProvider({ children }: { children: ReactNode }) {
    const { filters } = useExplorerState();

    const value = useMemo<ExplorerData>(() => {
        const matchingOfficialIds = new Set(
            TRAVEL_DATASET.officials
                .filter((official) => matchesOfficialFilters(official, filters))
                .map((official) => official.id)
        );
        const matchingRecords = TRAVEL_DATASET.records.filter(
            (record) =>
                matchingOfficialIds.has(record.officialId) && matchesTravelFilters(record, filters)
        );

        return {
            allOfficials: TRAVEL_DATASET.officials,
            countries: TRAVEL_DATASET.countries,
            countryByCode,
            matchingOfficialIds,
            matchingRecords,
            officialById,
            officialsByCountry,
            recordById,
            recordsByDestination: groupRecords(
                matchingRecords,
                (record) => record.destination.countryCode
            ),
            recordsByOfficial: groupRecords(matchingRecords, (record) => record.officialId),
            recordsByOrigin: groupRecords(matchingRecords, (record) => record.originCountryCode),
            today: toIsoDate(new Date()),
            travelFiltersActive: hasTravelFilters(filters),
        };
    }, [filters]);

    return <ExplorerDataContext value={value}>{children}</ExplorerDataContext>;
}

/**
 * Reads the filtered explorer dataset.
 *
 * @returns Indexed dataset for the current filters.
 */
export function useExplorerData(): ExplorerData {
    const context = use(ExplorerDataContext);

    if (!context) {
        throw new Error("useExplorerData must be used inside <ExplorerDataProvider>");
    }

    return context;
}

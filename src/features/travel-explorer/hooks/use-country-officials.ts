"use client";

import { useMemo } from "react";

import { useExplorerData } from "@/features/travel-explorer/hooks/use-explorer-data";
import type { Official } from "@/features/travel-explorer/types/travel.types";
import type { CountryCode } from "@/types/geo.types";

/**
 * Officials of a country that match the active filters, shared by the people and offices lists
 * so both always describe the same set.
 *
 * @param countryCode - Country whose officials to list.
 * @returns The matching officials, in dataset order.
 */
export function useCountryOfficials(countryCode: CountryCode): Official[] {
    const { matchingOfficialIds, officialsByCountry, recordsByOfficial, travelFiltersActive } =
        useExplorerData();

    return useMemo(
        () =>
            (officialsByCountry.get(countryCode) ?? []).filter(
                (official) =>
                    matchingOfficialIds.has(official.id) &&
                    // When trip filters are active, only officials with matching trips are relevant.
                    (!travelFiltersActive || recordsByOfficial.has(official.id))
            ),
        [
            countryCode,
            matchingOfficialIds,
            officialsByCountry,
            recordsByOfficial,
            travelFiltersActive,
        ]
    );
}

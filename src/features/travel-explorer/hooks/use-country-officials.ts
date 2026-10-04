"use client";

import { useMemo } from "react";

import { useExplorerData } from "@/features/travel-explorer/hooks/use-explorer-data";
import type { Official } from "@/features/travel-explorer/types/travel.types";
import type { CountryCode } from "@/types/geo.types";

interface CountryOfficials {
    /** Officials passing the person-level filters (name, party, role, tenure), in dataset order. */
    roster: Official[];
    /**
     * The roster narrowed to officials with trips matching the trip filters (dates, destinations,
     * types…), or the whole roster when no trip filter is active.
     */
    travelling: Official[];
}

/**
 * A country's officials, both as a roster (office history does not depend on when anyone
 * travelled) and as the subset whose travel matches the active trip filters.
 *
 * @param countryCode - Country whose officials to list.
 * @returns The roster and its travelling subset.
 */
export function useCountryOfficials(countryCode: CountryCode): CountryOfficials {
    const { matchingOfficialIds, officialsByCountry, recordsByOfficial, travelFiltersActive } =
        useExplorerData();

    return useMemo(() => {
        const roster = (officialsByCountry.get(countryCode) ?? []).filter((official) =>
            matchingOfficialIds.has(official.id)
        );
        const travelling = travelFiltersActive
            ? roster.filter((official) => recordsByOfficial.has(official.id))
            : roster;
        return { roster, travelling };
    }, [
        countryCode,
        matchingOfficialIds,
        officialsByCountry,
        recordsByOfficial,
        travelFiltersActive,
    ]);
}

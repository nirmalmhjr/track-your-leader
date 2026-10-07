"use client";

import { useMemo } from "react";

import { useExplorerData } from "@/features/travel-explorer/hooks/use-explorer-data";
import type { CountryCode } from "@/types/geo.types";
import type { Official } from "@/types/travel.types";

interface CountryOfficials {
    /** Officials passing the person-level filters (name, party, role, tenure), in dataset order. */
    roster: Official[];
    /**
     * The roster narrowed to officials with trips matching the trip filters (dates, destinations,
     * types…). Officials with no trips on record are left out even when every date is shown.
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
    const { matchingOfficialIds, officialsByCountry, recordsByOfficial } = useExplorerData();

    return useMemo(() => {
        const roster = (officialsByCountry.get(countryCode) ?? []).filter((official) =>
            matchingOfficialIds.has(official.id)
        );
        const travelling = roster.filter((official) => recordsByOfficial.has(official.id));
        return { roster, travelling };
    }, [countryCode, matchingOfficialIds, officialsByCountry, recordsByOfficial]);
}

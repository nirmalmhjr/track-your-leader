"use client";

import { useCallback } from "react";

import { useExplorerData } from "@/features/travel-explorer/hooks/use-explorer-data";
import {
    COUNTRY_DEFAULT_DATE_PRESET,
    useExplorerState,
} from "@/features/travel-explorer/hooks/use-explorer-state";
import type { CountryView } from "@/features/travel-explorer/types/explorer.types";
import { getPresetRange } from "@/features/travel-explorer/utils/date-presets.utils";
import type { CountryCode } from "@/types/geo.types";

/**
 * Opens a country from anywhere (map, list, search, filters). From the world view a country
 * starts on recent travel, unless it has none in that window: then it opens on all dates, so
 * a country that travelled recently-but-not-this-month never looks empty.
 *
 * @returns `openCountry(code, view)`; `null` returns to the world view.
 */
export function useOpenCountry() {
    const { allRecords, today } = useExplorerData();
    const { selectCountry } = useExplorerState();

    return useCallback(
        (code: CountryCode | null, view: CountryView = "officials") => {
            if (!code) {
                selectCountry(null, view);
                return;
            }
            const { from, to } = getPresetRange(COUNTRY_DEFAULT_DATE_PRESET, today);
            const isInbound = view === "inbound";
            const hasRecentTrips = allRecords.some(
                (record) =>
                    (isInbound ? record.destination.countryCode : record.originCountryCode) ===
                        code &&
                    (to === null || record.startDate <= to) &&
                    (from === null || record.endDate >= from)
            );
            selectCountry(code, view, { applyDefaultRange: hasRecentTrips });
        },
        [allRecords, selectCountry, today]
    );
}

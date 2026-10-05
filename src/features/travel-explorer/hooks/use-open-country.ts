"use client";

import { useCallback } from "react";

import { useExplorerState } from "@/features/travel-explorer/hooks/use-explorer-state";
import type { CountryView } from "@/features/travel-explorer/types/explorer.types";
import type { CountryCode } from "@/types/geo.types";

/**
 * Opens a country from anywhere (map, list, search, filters). From the world view a country
 * starts on recent travel (`COUNTRY_DEFAULT_DATE_PRESET`); a range the user already chose is kept.
 *
 * @returns `openCountry(code, view)`; `null` returns to the world view.
 */
export function useOpenCountry() {
    const { selectCountry } = useExplorerState();

    return useCallback(
        (code: CountryCode | null, view: CountryView = "officials") => selectCountry(code, view),
        [selectCountry]
    );
}

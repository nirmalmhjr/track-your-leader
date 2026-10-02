"use client";

import { useCallback } from "react";

import { useExplorerState } from "@/features/travel-explorer/hooks/use-explorer-state";
import type {
    ExplorerFilterKey,
    ExplorerFilters,
} from "@/features/travel-explorer/types/explorer.types";

/**
 * Stable setter for a single filter, so filter controls can be wired without inline callbacks.
 *
 * @param key - Filter to update.
 * @returns Callback that replaces the filter's value.
 */
export function useFilterSetter<TKey extends ExplorerFilterKey>(key: TKey) {
    const { setFilters } = useExplorerState();

    return useCallback(
        (value: ExplorerFilters[TKey]) => {
            const patch: Partial<ExplorerFilters> = {};
            patch[key] = value;
            setFilters(patch);
        },
        [key, setFilters]
    );
}

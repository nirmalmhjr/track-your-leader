"use client";

import { IconAdjustmentsHorizontal, IconX } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { useCallback } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActiveFilterChips } from "@/features/travel-explorer/components/filters/active-filter-chips";
import { DateRangePopover } from "@/features/travel-explorer/components/filters/date-range-popover";
import { useExplorerState } from "@/features/travel-explorer/hooks/use-explorer-state";
import { countActiveFilters } from "@/features/travel-explorer/utils/filters.utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useExplorerUiStore } from "@/stores/explorer-ui-store";

/** Date range, filter editor toggle and reset, followed by the active filters as chips. */
export function FilterBar() {
    const t = useTranslations("Explorer.filters");
    const { filters, resetFilters } = useExplorerState();
    const isFiltersOpen = useExplorerUiStore((state) => state.isFiltersOpen);
    const setFiltersOpen = useExplorerUiStore((state) => state.setFiltersOpen);
    const setSheetSnap = useExplorerUiStore((state) => state.setSheetSnap);
    const isTabletUp = useMediaQuery("(min-width: 768px)");
    const activeCount = countActiveFilters(filters);

    const toggleFilters = useCallback(() => {
        const next = !isFiltersOpen;
        setFiltersOpen(next);
        if (next && !isTabletUp) {
            setSheetSnap("full");
        }
    }, [isFiltersOpen, isTabletUp, setFiltersOpen, setSheetSnap]);

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <DateRangePopover />
                <Button
                    aria-expanded={isFiltersOpen}
                    onClick={toggleFilters}
                    size="sm"
                    variant={isFiltersOpen || activeCount > 0 ? "secondary" : "outline"}
                >
                    {isFiltersOpen ? (
                        <IconX data-icon="inline-start" />
                    ) : (
                        <IconAdjustmentsHorizontal data-icon="inline-start" />
                    )}
                    {isFiltersOpen ? t("close") : t("open")}
                    {activeCount > 0 && !isFiltersOpen ? (
                        <Badge className="h-4 min-w-4 px-1 tabular-nums">{activeCount}</Badge>
                    ) : null}
                </Button>
                {activeCount > 0 ? (
                    <Button className="ml-auto" onClick={resetFilters} size="sm" variant="ghost">
                        {t("reset")}
                    </Button>
                ) : null}
            </div>
            <ActiveFilterChips />
        </div>
    );
}

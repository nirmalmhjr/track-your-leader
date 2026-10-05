"use client";

import { IconAdjustmentsHorizontal, IconCalendar, IconX } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { useCallback } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActiveFilterChips } from "@/features/travel-explorer/components/filters/active-filter-chips";
import { DateRangePopover } from "@/features/travel-explorer/components/filters/date-range-popover";
import { useExplorerData } from "@/features/travel-explorer/hooks/use-explorer-data";
import { useExplorerState } from "@/features/travel-explorer/hooks/use-explorer-state";
import {
    countActiveFilters,
    withoutDateRange,
} from "@/features/travel-explorer/utils/filters.utils";
import { useExplorerUiStore } from "@/stores/explorer-ui-store";

/** Stands in for the date range while former officials' whole histories are shown. */
function DateRangeIgnored({ isOneOfficial }: { isOneOfficial: boolean }) {
    const t = useTranslations("Explorer.dates");

    return (
        <span className="inline-flex h-8 min-w-0 items-center gap-1.5 rounded-[min(var(--radius-md),10px)] border border-dashed px-2.5 text-muted-foreground text-xs">
            <IconCalendar aria-hidden className="size-3.5 shrink-0" />
            <span className="truncate">
                {isOneOfficial ? t("ignoredForFormerOfficial") : t("ignoredForFormerOfficials")}
            </span>
        </span>
    );
}

/** Date range, filter editor toggle and reset, followed by the active filters as chips. */
export function FilterBar() {
    const t = useTranslations("Explorer.filters");
    const { filters, resetFilters } = useExplorerState();
    const { dateRangeIgnoredFor } = useExplorerData();
    const isDateRangeIgnored = dateRangeIgnoredFor !== null;
    const isFiltersOpen = useExplorerUiStore((state) => state.isFiltersOpen);
    const setFiltersOpen = useExplorerUiStore((state) => state.setFiltersOpen);
    const activeCount = countActiveFilters(
        isDateRangeIgnored ? withoutDateRange(filters) : filters
    );

    const toggleFilters = useCallback(
        () => setFiltersOpen(!isFiltersOpen),
        [isFiltersOpen, setFiltersOpen]
    );

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
                {isDateRangeIgnored ? (
                    <DateRangeIgnored isOneOfficial={dateRangeIgnoredFor === "official"} />
                ) : (
                    <DateRangePopover />
                )}
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

"use client";

import { IconLayoutSidebarRightCollapse } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { FiltersView } from "@/features/travel-explorer/components/filters/filters-view";
import { CountryView } from "@/features/travel-explorer/components/panel/country-view";
import { DataAttribution } from "@/features/travel-explorer/components/panel/data-attribution";
import { DataStatus } from "@/features/travel-explorer/components/panel/data-status";
import { FilterBar } from "@/features/travel-explorer/components/panel/filter-bar";
import { OfficialView } from "@/features/travel-explorer/components/panel/official-view";
import { OverviewView } from "@/features/travel-explorer/components/panel/overview-view";
import { PanelBreadcrumb } from "@/features/travel-explorer/components/panel/panel-breadcrumb";
import { TripView } from "@/features/travel-explorer/components/panel/trip-view";
import { EXPLORER_PANEL_ID } from "@/features/travel-explorer/constants/explorer.constants";
import { useExplorerData } from "@/features/travel-explorer/hooks/use-explorer-data";
import { useExplorerState } from "@/features/travel-explorer/hooks/use-explorer-state";
import { usePanelSwipe } from "@/features/travel-explorer/hooks/use-panel-swipe";
import { cn } from "@/lib/utils";
import { useExplorerUiStore } from "@/stores/explorer-ui-store";

function PanelBody() {
    const { selection, level } = useExplorerState();
    const { status } = useExplorerData();

    if (status !== "ready") {
        return <DataStatus />;
    }

    if (level === "trip" && selection.trip) {
        return <TripView recordId={selection.trip} />;
    }
    if (level === "official" && selection.official) {
        return <OfficialView officialId={selection.official} />;
    }
    if (selection.country) {
        return <CountryView countryCode={selection.country} />;
    }
    return <OverviewView />;
}

/**
 * Exploration panel: a floating drawer on the right of the map, below the header. Its hide
 * button or a swipe to the right closes it so the map fills the screen; the menu button on the
 * map brings it back.
 */
export function ExplorerPanel() {
    const t = useTranslations("Explorer.panel");
    const { selection } = useExplorerState();
    const isFiltersOpen = useExplorerUiStore((state) => state.isFiltersOpen);
    const setPanelOpen = useExplorerUiStore((state) => state.setPanelOpen);
    const isPanelOpen = useExplorerUiStore((state) => state.isPanelOpen);
    const { dragOffsetX, handlers } = usePanelSwipe();
    const closePanel = useCallback(() => setPanelOpen(false), [setPanelOpen]);
    const scrollRef = useRef<HTMLDivElement>(null);

    const clearHover = useExplorerUiStore((state) => state.clearHover);
    const viewKey = `${selection.country}|${selection.official}|${selection.trip}|${selection.view}|${isFiltersOpen}`;

    // Each view starts at the top, and highlights from elements that just unmounted are dropped.
    useEffect(() => {
        if (viewKey) {
            scrollRef.current?.scrollTo({ top: 0 });
            clearHover();
        }
    }, [viewKey, clearHover]);

    return (
        <aside
            aria-label={t("label")}
            className={cn(
                "absolute top-3 right-3 bottom-3 z-30 flex w-[calc(100%-3rem)] touch-pan-y flex-col overflow-hidden rounded-xl border bg-sidebar shadow-lg sm:w-[380px] xl:w-[420px]",
                dragOffsetX === null && "transition-transform duration-300 ease-out",
                !isPanelOpen && "pointer-events-none translate-x-[calc(100%+1rem)]"
            )}
            id={EXPLORER_PANEL_ID}
            inert={!isPanelOpen}
            style={dragOffsetX === null ? undefined : { translate: `${dragOffsetX}px 0` }}
            {...handlers}
        >
            <div className="flex shrink-0 flex-col gap-2 border-b px-4 pt-3 pb-3">
                <div className="flex items-center justify-between gap-2">
                    <PanelBreadcrumb />
                    <Button
                        aria-label={t("collapse")}
                        className="shrink-0"
                        onClick={closePanel}
                        size="icon-sm"
                        variant="ghost"
                    >
                        <IconLayoutSidebarRightCollapse />
                    </Button>
                </div>
                <FilterBar />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" ref={scrollRef}>
                {isFiltersOpen ? <FiltersView /> : <PanelBody />}
                <DataAttribution />
            </div>
        </aside>
    );
}

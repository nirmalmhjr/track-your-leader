"use client";

import { IconLayoutSidebarLeftCollapse } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { type CSSProperties, useCallback, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { FiltersView } from "@/features/travel-explorer/components/filters/filters-view";
import { CountryView } from "@/features/travel-explorer/components/panel/country-view";
import { DataAttribution } from "@/features/travel-explorer/components/panel/data-attribution";
import { FilterBar } from "@/features/travel-explorer/components/panel/filter-bar";
import { OfficialView } from "@/features/travel-explorer/components/panel/official-view";
import { OverviewView } from "@/features/travel-explorer/components/panel/overview-view";
import { PanelBreadcrumb } from "@/features/travel-explorer/components/panel/panel-breadcrumb";
import { TripView } from "@/features/travel-explorer/components/panel/trip-view";
import { SHEET_SNAP_POINTS } from "@/features/travel-explorer/constants/explorer.constants";
import { useExplorerState } from "@/features/travel-explorer/hooks/use-explorer-state";
import { usePanelSwipe } from "@/features/travel-explorer/hooks/use-panel-swipe";
import type { SheetSnapPoint } from "@/features/travel-explorer/types/explorer.types";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { useExplorerUiStore } from "@/stores/explorer-ui-store";

function PanelBody() {
    const { selection, level } = useExplorerState();

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

function SheetHandle() {
    const t = useTranslations("Explorer.panel");
    const snap = useExplorerUiStore((state) => state.sheetSnap);
    const setSheetSnap = useExplorerUiStore((state) => state.setSheetSnap);

    const snapIndex = SHEET_SNAP_POINTS.indexOf(snap);
    const nextSnap: SheetSnapPoint = SHEET_SNAP_POINTS[(snapIndex + 1) % SHEET_SNAP_POINTS.length];
    const handleClick = useCallback(() => setSheetSnap(nextSnap), [nextSnap, setSheetSnap]);

    return (
        <button
            aria-label={t(`handle.${nextSnap}`)}
            className="flex h-6 w-full shrink-0 items-center justify-center outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:hidden"
            onClick={handleClick}
            type="button"
        >
            <span aria-hidden className="h-1 w-10 rounded-full bg-muted-foreground/40" />
        </button>
    );
}

/**
 * Exploration panel. One element adapts per breakpoint: a bottom sheet on phones that is
 * swiped between heights, a floating drawer on tablets that is swiped away to the left, and
 * a docked sidebar on desktop.
 */
export function ExplorerPanel() {
    const t = useTranslations("Explorer.panel");
    const { selection, level } = useExplorerState();
    const isFiltersOpen = useExplorerUiStore((state) => state.isFiltersOpen);
    const isPanelCollapsed = useExplorerUiStore((state) => state.isPanelCollapsed);
    const setPanelCollapsed = useExplorerUiStore((state) => state.setPanelCollapsed);
    const setSheetSnap = useExplorerUiStore((state) => state.setSheetSnap);
    const isTabletUp = useMediaQuery("(min-width: 768px)");
    const { dragOffsetX, handlers, isSwipeEnabled, isSwiping, sheetHeight } = usePanelSwipe();
    const collapsePanel = useCallback(() => setPanelCollapsed(true), [setPanelCollapsed]);
    const scrollRef = useRef<HTMLDivElement>(null);
    /** Selection the sheet was last opened for, so a sheet minimised by hand stays minimised. */
    const revealedSelectionRef = useRef<string | null>(null);

    const clearHover = useExplorerUiStore((state) => state.clearHover);
    const selectionKey = `${selection.country}|${selection.official}|${selection.trip}`;
    const viewKey = `${selectionKey}|${selection.view}|${isFiltersOpen}`;

    // Each view starts at the top, and highlights from elements that just unmounted are dropped.
    useEffect(() => {
        if (viewKey) {
            scrollRef.current?.scrollTo({ top: 0 });
            clearHover();
        }
    }, [viewKey, clearHover]);

    // On phones, reveal content when a new selection is made from the map or search.
    useEffect(() => {
        if (revealedSelectionRef.current === selectionKey) {
            return;
        }
        revealedSelectionRef.current = selectionKey;
        const isPeeking = useExplorerUiStore.getState().sheetSnap === "peek";
        if (!isTabletUp && level !== "world" && isPeeking) {
            setSheetSnap("half");
        }
    }, [isTabletUp, level, selectionKey, setSheetSnap]);

    return (
        <aside
            aria-label={t("label")}
            className={cn(
                "fixed inset-x-0 bottom-0 z-30 flex h-(--sheet-height) flex-col overflow-hidden rounded-t-2xl border-t bg-sidebar shadow-[0_-12px_32px_-16px_rgb(0_0_0/0.35)]",
                !isSwiping && "transition-[height] duration-300 ease-out",
                "md:absolute md:inset-x-auto md:top-3 md:bottom-3 md:left-3 md:h-auto md:w-[380px] md:rounded-xl md:border md:shadow-lg md:transition-transform",
                isSwiping && "md:transition-none",
                isPanelCollapsed && "md:pointer-events-none md:-translate-x-[calc(100%+1rem)]",
                "lg:pointer-events-auto lg:static lg:z-auto lg:w-[400px] lg:translate-x-0 lg:rounded-none lg:border-0 lg:border-r lg:shadow-none xl:w-[420px]"
            )}
            style={
                {
                    "--sheet-height": `${sheetHeight}px`,
                    translate: dragOffsetX === null ? undefined : `${dragOffsetX}px 0`,
                } as CSSProperties
            }
        >
            {/* Swipe area: the grab handle plus the header, so the whole top of the panel can be dragged. */}
            <div
                className={cn("flex shrink-0 flex-col", isSwipeEnabled && "touch-none select-none")}
                {...handlers}
            >
                <SheetHandle />
                <div className="flex flex-col gap-2 border-b px-4 pt-1 pb-3 md:pt-3">
                    <div className="flex items-center justify-between gap-2">
                        <PanelBreadcrumb />
                        <Button
                            aria-label={t("collapse")}
                            className="hidden shrink-0 md:inline-flex lg:hidden"
                            onClick={collapsePanel}
                            size="icon-sm"
                            variant="ghost"
                        >
                            <IconLayoutSidebarLeftCollapse />
                        </Button>
                    </div>
                    <FilterBar />
                </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" ref={scrollRef}>
                {isFiltersOpen ? <FiltersView /> : <PanelBody />}
                <DataAttribution />
            </div>
        </aside>
    );
}

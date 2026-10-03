"use client";

import { IconLayoutSidebarLeftCollapse } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import {
    type CSSProperties,
    type PointerEvent,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";

import { Button } from "@/components/ui/button";
import { FiltersView } from "@/features/travel-explorer/components/filters/filters-view";
import { CountryView } from "@/features/travel-explorer/components/panel/country-view";
import { DataAttribution } from "@/features/travel-explorer/components/panel/data-attribution";
import { FilterBar } from "@/features/travel-explorer/components/panel/filter-bar";
import { OfficialView } from "@/features/travel-explorer/components/panel/official-view";
import { OverviewView } from "@/features/travel-explorer/components/panel/overview-view";
import { PanelBreadcrumb } from "@/features/travel-explorer/components/panel/panel-breadcrumb";
import { TripView } from "@/features/travel-explorer/components/panel/trip-view";
import {
    SHEET_PEEK_HEIGHT_PX,
    SHEET_SNAP_POINTS,
} from "@/features/travel-explorer/constants/explorer.constants";
import { useExplorerState } from "@/features/travel-explorer/hooks/use-explorer-state";
import { getSnapHeight, useSheetHeight } from "@/features/travel-explorer/hooks/use-sheet-height";
import type { SheetSnapPoint } from "@/features/travel-explorer/types/explorer.types";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { useExplorerUiStore } from "@/stores/explorer-ui-store";

/** Movement below this distance counts as a tap on the sheet handle rather than a drag. */
const DRAG_THRESHOLD_PX = 6;
const CLICK_AFTER_DRAG_MS = 300;

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

function SheetHandle({
    currentHeight,
    onDrag,
}: {
    currentHeight: number;
    onDrag: (height: number | null) => void;
}) {
    const t = useTranslations("Explorer.panel");
    const { snap, viewportHeight } = useSheetHeight();
    const setSheetSnap = useExplorerUiStore((state) => state.setSheetSnap);
    const dragRef = useRef<{ startY: number; startHeight: number; moved: boolean } | null>(null);
    /** Time the last drag ended; the click that follows a drag must not also toggle the sheet. */
    const lastDragEndRef = useRef(0);

    const snapIndex = SHEET_SNAP_POINTS.indexOf(snap);
    const nextSnap: SheetSnapPoint = SHEET_SNAP_POINTS[(snapIndex + 1) % SHEET_SNAP_POINTS.length];

    const handleClick = useCallback(() => {
        if (performance.now() - lastDragEndRef.current < CLICK_AFTER_DRAG_MS) {
            return;
        }
        setSheetSnap(nextSnap);
    }, [nextSnap, setSheetSnap]);

    const handlePointerDown = useCallback(
        (event: PointerEvent<HTMLButtonElement>) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            dragRef.current = { moved: false, startHeight: currentHeight, startY: event.clientY };
        },
        [currentHeight]
    );

    const handlePointerMove = useCallback(
        (event: PointerEvent<HTMLButtonElement>) => {
            const drag = dragRef.current;
            if (!drag) {
                return;
            }
            const delta = drag.startY - event.clientY;
            if (Math.abs(delta) > DRAG_THRESHOLD_PX) {
                drag.moved = true;
            }
            if (drag.moved) {
                const maxHeight = getSnapHeight("full", viewportHeight);
                onDrag(
                    Math.min(Math.max(drag.startHeight + delta, SHEET_PEEK_HEIGHT_PX), maxHeight)
                );
            }
        },
        [onDrag, viewportHeight]
    );

    const handlePointerUp = useCallback(
        (event: PointerEvent<HTMLButtonElement>) => {
            const drag = dragRef.current;
            dragRef.current = null;
            if (!drag?.moved) {
                return;
            }

            lastDragEndRef.current = performance.now();
            const releasedHeight = drag.startHeight + (drag.startY - event.clientY);
            const nearest = SHEET_SNAP_POINTS.reduce((best, candidate) =>
                Math.abs(getSnapHeight(candidate, viewportHeight) - releasedHeight) <
                Math.abs(getSnapHeight(best, viewportHeight) - releasedHeight)
                    ? candidate
                    : best
            );
            setSheetSnap(nearest);
            onDrag(null);
        },
        [onDrag, setSheetSnap, viewportHeight]
    );

    const handlePointerCancel = useCallback(() => {
        dragRef.current = null;
        onDrag(null);
    }, [onDrag]);

    return (
        <button
            aria-label={t(`handle.${nextSnap}`)}
            className="flex h-6 w-full shrink-0 touch-none items-center justify-center outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:hidden"
            onClick={handleClick}
            onPointerCancel={handlePointerCancel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            type="button"
        >
            <span aria-hidden className="h-1 w-10 rounded-full bg-muted-foreground/40" />
        </button>
    );
}

/**
 * Exploration panel. One element adapts per breakpoint: a draggable bottom sheet on phones,
 * a floating collapsible drawer on tablets and a docked sidebar on desktop.
 */
export function ExplorerPanel() {
    const t = useTranslations("Explorer.panel");
    const { selection, level } = useExplorerState();
    const isFiltersOpen = useExplorerUiStore((state) => state.isFiltersOpen);
    const isPanelCollapsed = useExplorerUiStore((state) => state.isPanelCollapsed);
    const setPanelCollapsed = useExplorerUiStore((state) => state.setPanelCollapsed);
    const sheetSnap = useExplorerUiStore((state) => state.sheetSnap);
    const setSheetSnap = useExplorerUiStore((state) => state.setSheetSnap);
    const isTabletUp = useMediaQuery("(min-width: 768px)");
    const { height: snapHeight } = useSheetHeight();
    const [dragHeight, setDragHeight] = useState<number | null>(null);
    const collapsePanel = useCallback(() => setPanelCollapsed(true), [setPanelCollapsed]);
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

    // On phones, reveal content when a selection is made from the map or search.
    useEffect(() => {
        if (!isTabletUp && level !== "world" && sheetSnap === "peek") {
            setSheetSnap("half");
        }
    }, [isTabletUp, level, sheetSnap, setSheetSnap]);

    const sheetHeight = dragHeight ?? snapHeight;

    return (
        <aside
            aria-label={t("label")}
            className={cn(
                "fixed inset-x-0 bottom-0 z-30 flex h-(--sheet-height) flex-col overflow-hidden rounded-t-2xl border-t bg-sidebar shadow-[0_-12px_32px_-16px_rgb(0_0_0/0.35)]",
                dragHeight === null && "transition-[height] duration-300 ease-out",
                "md:absolute md:inset-x-auto md:top-3 md:bottom-3 md:left-3 md:h-auto md:w-[380px] md:rounded-xl md:border md:shadow-lg md:transition-transform",
                isPanelCollapsed && "md:pointer-events-none md:-translate-x-[calc(100%+1rem)]",
                "lg:pointer-events-auto lg:static lg:z-auto lg:w-[400px] lg:translate-x-0 lg:rounded-none lg:border-0 lg:border-r lg:shadow-none xl:w-[420px]"
            )}
            style={{ "--sheet-height": `${sheetHeight}px` } as CSSProperties}
        >
            <SheetHandle currentHeight={sheetHeight} onDrag={setDragHeight} />
            <div className="flex shrink-0 flex-col gap-2 border-b px-4 pt-1 pb-3 md:pt-3">
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
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" ref={scrollRef}>
                {isFiltersOpen ? <FiltersView /> : <PanelBody />}
                <DataAttribution />
            </div>
        </aside>
    );
}

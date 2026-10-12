"use client";

import { IconLayoutSidebarRightCollapse } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";

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
import {
    EXPLORER_PANEL_ID,
    SHEET_HALF_RATIO,
    TABLET_UP_MEDIA_QUERY,
} from "@/features/travel-explorer/constants/explorer.constants";
import { useExplorerData } from "@/features/travel-explorer/hooks/use-explorer-data";
import { useExplorerState } from "@/features/travel-explorer/hooks/use-explorer-state";
import { cancelHoverHighlight } from "@/features/travel-explorer/hooks/use-hover-highlight";
import { usePanelSwipe } from "@/features/travel-explorer/hooks/use-panel-swipe";
import { useSheetDrag } from "@/features/travel-explorer/hooks/use-sheet-drag";
import type { SheetSnap } from "@/features/travel-explorer/types/explorer.types";
import {
    getNextSheetSnap,
    getSheetSnapOffsets,
} from "@/features/travel-explorer/utils/sheet-snap.utils";
import { useElementSize } from "@/hooks/use-element-size";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { useExplorerUiStore } from "@/stores/explorer-ui-store";

/**
 * Sheet offsets used before the sheet has been measured (server render and first paint), as CSS
 * relative to the sheet's own height. The peek height approximates the header's.
 */
const UNMEASURED_SHEET_OFFSETS: Record<SheetSnap, string> = {
    full: "0px",
    half: `${(1 - SHEET_HALF_RATIO) * 100}%`,
    peek: "calc(100% - 7.5rem)",
};

type SheetStyle = CSSProperties & { "--sheet-offset": string };

function PanelBody() {
    const { selection, level } = useExplorerState();
    const { status, worldStats } = useExplorerData();

    // The world overview can show from its summary while the rest of the data loads.
    if (status !== "ready" && !(level === "world" && worldStats)) {
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

/** Grip at the top of the phone bottom sheet. Dragging moves the sheet; a tap steps it up. */
function SheetHandle() {
    const t = useTranslations("Explorer.panel");
    const sheetSnap = useExplorerUiStore((state) => state.sheetSnap);
    const setSheetSnap = useExplorerUiStore((state) => state.setSheetSnap);
    const stepSnap = useCallback(
        () => setSheetSnap(getNextSheetSnap(sheetSnap)),
        [sheetSnap, setSheetSnap]
    );

    return (
        <button
            aria-controls={EXPLORER_PANEL_ID}
            aria-expanded={sheetSnap !== "peek"}
            aria-label={sheetSnap === "full" ? t("sheetCollapse") : t("sheetExpand")}
            className="flex h-6 w-full items-center justify-center outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:hidden"
            onClick={stepSnap}
            type="button"
        >
            <span aria-hidden className="h-1.5 w-10 rounded-full bg-muted-foreground/40" />
        </button>
    );
}

/**
 * Exploration panel. Tablets and up: a floating drawer on the right of the map, below the header;
 * its hide button or a swipe to the right closes it, and the menu button on the map brings it
 * back. Phones: a bottom sheet that starts peeking with only its header showing, so the map stays
 * in view, and is dragged or tapped up to half or full height.
 */
export function ExplorerPanel() {
    const t = useTranslations("Explorer.panel");
    const { selection } = useExplorerState();
    const isFiltersOpen = useExplorerUiStore((state) => state.isFiltersOpen);
    const isPanelOpen = useExplorerUiStore((state) => state.isPanelOpen);
    const setPanelOpen = useExplorerUiStore((state) => state.setPanelOpen);
    const sheetSnap = useExplorerUiStore((state) => state.sheetSnap);
    const setSheetCoverPx = useExplorerUiStore((state) => state.setSheetCoverPx);
    const clearHover = useExplorerUiStore((state) => state.clearHover);
    const formerSideCountry = useExplorerUiStore((state) => state.formerSideCountry);
    const setFormerSideCountry = useExplorerUiStore((state) => state.setFormerSideCountry);
    const isTabletUp = useMediaQuery(TABLET_UP_MEDIA_QUERY);
    const closePanel = useCallback(() => setPanelOpen(false), [setPanelOpen]);
    const scrollRef = useRef<HTMLDivElement>(null);

    const [sheetRef, sheetSize] = useElementSize<HTMLElement>();
    const [peekRef, peekSize] = useElementSize<HTMLDivElement>();
    const isMeasured = sheetSize.height > 0 && peekSize.height > 0;
    const offsets = useMemo(
        () => getSheetSnapOffsets(sheetSize.height, peekSize.height),
        [sheetSize.height, peekSize.height]
    );
    const { dragOffsetX, handlers: swipeHandlers } = usePanelSwipe();
    const { dragOffsetY, handlers: sheetHandlers } = useSheetDrag(offsets);
    const isDragging = dragOffsetX !== null || dragOffsetY !== null;
    const isSheetPeeking = !isTabletUp && sheetSnap === "peek";

    const restingOffset = isMeasured
        ? `${offsets[sheetSnap]}px`
        : UNMEASURED_SHEET_OFFSETS[sheetSnap];
    const sheetStyle: SheetStyle = {
        "--sheet-offset": dragOffsetY === null ? restingOffset : `${dragOffsetY}px`,
    };
    const style: CSSProperties =
        dragOffsetX === null ? sheetStyle : { ...sheetStyle, translate: `${dragOffsetX}px 0` };

    // A full sheet hides the map anyway, so the map stays framed above the half-height sheet.
    const coveredSnap = sheetSnap === "full" ? "half" : sheetSnap;
    const sheetCoverPx = isMeasured ? sheetSize.height - offsets[coveredSnap] : 0;
    useEffect(() => setSheetCoverPx(sheetCoverPx), [sheetCoverPx, setSheetCoverPx]);

    // A link to a country, official or trip opens the sheet on it rather than leaving it peeking.
    const [isOpenedOnSelection] = useState(selection.country !== null);
    useEffect(() => {
        if (isOpenedOnSelection) {
            setPanelOpen(true);
        }
    }, [isOpenedOnSelection, setPanelOpen]);

    const viewKey = `${selection.country}|${selection.official}|${selection.trip}|${selection.view}|${isFiltersOpen}`;

    // Each view starts at the top, and highlights from elements that just unmounted are dropped.
    useEffect(() => {
        if (viewKey) {
            scrollRef.current?.scrollTo({ top: 0 });
            cancelHoverHighlight();
            clearHover();
        }
    }, [viewKey, clearHover]);

    // Leaving a country closes its former side, so every country opens on who is in office now.
    useEffect(() => {
        if (formerSideCountry !== null && formerSideCountry !== selection.country) {
            setFormerSideCountry(null);
        }
    }, [formerSideCountry, selection.country, setFormerSideCountry]);

    return (
        <aside
            aria-label={t("label")}
            className={cn(
                "absolute z-30 flex flex-col overflow-hidden border bg-sidebar shadow-lg",
                "max-md:inset-x-0 max-md:top-3 max-md:bottom-0 max-md:translate-y-(--sheet-offset) max-md:rounded-t-2xl max-md:border-x-0 max-md:border-b-0",
                "md:top-3 md:right-3 md:bottom-3 md:w-[380px] md:touch-pan-y md:rounded-xl xl:w-[420px]",
                !isDragging &&
                    "transition-transform duration-300 ease-out motion-reduce:transition-none",
                !isPanelOpen && "md:pointer-events-none md:translate-x-[calc(100%+1rem)]"
            )}
            id={EXPLORER_PANEL_ID}
            inert={isTabletUp && !isPanelOpen}
            ref={sheetRef}
            style={style}
            {...(isTabletUp ? swipeHandlers : undefined)}
        >
            <div
                className="shrink-0 max-md:touch-pan-x"
                ref={peekRef}
                {...(isTabletUp ? undefined : sheetHandlers)}
            >
                <SheetHandle />
                <div className="flex flex-col gap-2 border-b px-4 pt-1 pb-3 md:pt-3">
                    <div className="flex items-center justify-between gap-2">
                        <PanelBreadcrumb />
                        <Button
                            aria-label={t("collapse")}
                            className="shrink-0 max-md:hidden"
                            onClick={closePanel}
                            size="icon-sm"
                            variant="ghost"
                        >
                            <IconLayoutSidebarRightCollapse />
                        </Button>
                    </div>
                    <FilterBar />
                </div>
            </div>
            <div
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
                inert={isSheetPeeking}
                ref={scrollRef}
                // The part of a half-height sheet below the screen stays reachable by scrolling.
                style={
                    isTabletUp || !isMeasured ? undefined : { paddingBottom: offsets[sheetSnap] }
                }
            >
                {isFiltersOpen ? <FiltersView /> : <PanelBody />}
                <DataAttribution />
            </div>
        </aside>
    );
}

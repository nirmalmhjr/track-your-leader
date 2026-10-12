"use client";

import { useMemo } from "react";

import {
    MapErrorState,
    MapLoadingState,
} from "@/features/travel-explorer/components/map/map-status";
import { WorldMapCanvas } from "@/features/travel-explorer/components/map/world-map-canvas";
import { PanelToggle } from "@/features/travel-explorer/components/panel/panel-toggle";
import {
    PANEL_GAP_PX,
    PANEL_WIDTH_PX,
    PANEL_WIDTH_XL_PX,
    TABLET_UP_MEDIA_QUERY,
} from "@/features/travel-explorer/constants/explorer.constants";
import { useExplorerData } from "@/features/travel-explorer/hooks/use-explorer-data";
import { useWorldShapes } from "@/features/travel-explorer/hooks/use-world-shapes";
import { useElementSize } from "@/hooks/use-element-size";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useExplorerUiStore } from "@/stores/explorer-ui-store";

const EDGE_GAP_PX = 12;
/** Room kept free for the scope summary at the top of the map. */
const TOP_OVERLAY_PX = 88;

/**
 * Map viewport. Works out which parts of the screen panels cover so framing, controls and
 * overlays always land in the visible area on every layout.
 */
export function WorldMap() {
    const [containerRef, size] = useElementSize<HTMLDivElement>();
    const world = useWorldShapes();
    const { status: dataStatus, worldStats } = useExplorerData();
    const isTabletUp = useMediaQuery(TABLET_UP_MEDIA_QUERY);
    const isWide = useMediaQuery("(min-width: 1280px)");
    const isPanelOpen = useExplorerUiStore((state) => state.isPanelOpen);
    const sheetCoverPx = useExplorerUiStore((state) => state.sheetCoverPx);
    const mapStyle = useExplorerUiStore((state) => state.mapStyle);

    // Tablets and up: the open side drawer narrows the area the map frames into from the right.
    // Phones: the bottom sheet shortens it from below.
    const panelWidth = isWide ? PANEL_WIDTH_XL_PX : PANEL_WIDTH_PX;
    const panelRight = isTabletUp && isPanelOpen ? panelWidth + 2 * PANEL_GAP_PX : 0;
    const panelBottom = isTabletUp ? 0 : sheetCoverPx;

    const insets = useMemo(
        () => ({
            bottom: panelBottom + EDGE_GAP_PX,
            left: EDGE_GAP_PX,
            right: panelRight + EDGE_GAP_PX,
            top: TOP_OVERLAY_PX,
        }),
        [panelRight, panelBottom]
    );
    const overlayOffsets = useMemo(
        () => ({
            bottom: panelBottom + EDGE_GAP_PX,
            left: EDGE_GAP_PX,
            right: panelRight + EDGE_GAP_PX,
        }),
        [panelRight, panelBottom]
    );

    const hasSize = size.width > 0 && size.height > 0;

    return (
        <div
            className="relative min-w-0 flex-1 overflow-hidden bg-(--map-ocean)"
            data-map-style={mapStyle}
            ref={containerRef}
        >
            {world.status === "ready" && hasSize ? (
                <WorldMapCanvas
                    height={size.height}
                    insets={insets}
                    overlayOffsets={overlayOffsets}
                    shapes={world.shapes}
                    width={size.width}
                />
            ) : null}
            {world.status === "loading" ||
            (dataStatus === "loading" && !worldStats) ||
            (world.status === "ready" && !hasSize) ? (
                <MapLoadingState />
            ) : null}
            {world.status === "error" ? <MapErrorState onRetry={world.retry} /> : null}
            {isTabletUp && !isPanelOpen ? <PanelToggle /> : null}
        </div>
    );
}

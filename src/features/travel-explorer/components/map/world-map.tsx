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
    const { status: dataStatus } = useExplorerData();
    const isTabletUp = useMediaQuery("(min-width: 768px)");
    const isWide = useMediaQuery("(min-width: 1280px)");
    const isPanelOpen = useExplorerUiStore((state) => state.isPanelOpen);

    // On phones the open panel covers nearly the whole map, so it overlays the map rather than
    // shrinking the area the map frames into.
    const panelWidth = isWide ? PANEL_WIDTH_XL_PX : PANEL_WIDTH_PX;
    const panelRight = isTabletUp && isPanelOpen ? panelWidth + 2 * PANEL_GAP_PX : 0;

    const insets = useMemo(
        () => ({
            bottom: EDGE_GAP_PX,
            left: EDGE_GAP_PX,
            right: panelRight + EDGE_GAP_PX,
            top: TOP_OVERLAY_PX,
        }),
        [panelRight]
    );
    const overlayOffsets = useMemo(
        () => ({ bottom: EDGE_GAP_PX, left: EDGE_GAP_PX, right: panelRight + EDGE_GAP_PX }),
        [panelRight]
    );

    const hasSize = size.width > 0 && size.height > 0;

    return (
        <div className="relative min-w-0 flex-1 overflow-hidden bg-background" ref={containerRef}>
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
            dataStatus === "loading" ||
            (world.status === "ready" && !hasSize) ? (
                <MapLoadingState />
            ) : null}
            {world.status === "error" ? <MapErrorState onRetry={world.retry} /> : null}
            {isPanelOpen ? null : <PanelToggle />}
        </div>
    );
}

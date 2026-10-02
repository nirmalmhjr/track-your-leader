"use client";

import { IconLayoutSidebarLeftExpand } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { useCallback, useMemo } from "react";

import { Button } from "@/components/ui/button";
import {
    MapErrorState,
    MapLoadingState,
} from "@/features/travel-explorer/components/map/map-status";
import { WorldMapCanvas } from "@/features/travel-explorer/components/map/world-map-canvas";
import { useSheetHeight } from "@/features/travel-explorer/hooks/use-sheet-height";
import { useWorldShapes } from "@/features/travel-explorer/hooks/use-world-shapes";
import { useElementSize } from "@/hooks/use-element-size";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useExplorerUiStore } from "@/stores/explorer-ui-store";

/** Width of the floating tablet panel plus its outer margin. */
const FLOATING_PANEL_SPACE_PX = 380 + 24;
const EDGE_GAP_PX = 12;
/** Room kept free for the scope summary at the top and zoom controls on the right. */
const TOP_OVERLAY_PX = 88;
const RIGHT_OVERLAY_PX = 56;

/**
 * Map viewport. Works out which parts of the screen panels cover so framing, controls and
 * overlays always land in the visible area on every layout.
 */
export function WorldMap() {
    const t = useTranslations("Explorer.panel");
    const [containerRef, size] = useElementSize<HTMLDivElement>();
    const world = useWorldShapes();
    const isTabletUp = useMediaQuery("(min-width: 768px)");
    const isDesktop = useMediaQuery("(min-width: 1024px)");
    const isPanelCollapsed = useExplorerUiStore((state) => state.isPanelCollapsed);
    const setPanelCollapsed = useExplorerUiStore((state) => state.setPanelCollapsed);
    const { height: sheetHeight } = useSheetHeight();
    const expandPanel = useCallback(() => setPanelCollapsed(false), [setPanelCollapsed]);

    const isFloatingPanelOpen = isTabletUp && !isDesktop && !isPanelCollapsed;
    const panelLeft = isFloatingPanelOpen ? FLOATING_PANEL_SPACE_PX : 0;
    const panelBottom = isTabletUp ? 0 : sheetHeight;

    const insets = useMemo(
        () => ({
            bottom: panelBottom + EDGE_GAP_PX,
            left: panelLeft + EDGE_GAP_PX,
            right: RIGHT_OVERLAY_PX,
            top: TOP_OVERLAY_PX,
        }),
        [panelBottom, panelLeft]
    );
    const overlayOffsets = useMemo(
        () => ({ bottom: panelBottom + EDGE_GAP_PX, left: panelLeft + EDGE_GAP_PX }),
        [panelBottom, panelLeft]
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
            {world.status === "loading" || (world.status === "ready" && !hasSize) ? (
                <MapLoadingState />
            ) : null}
            {world.status === "error" ? <MapErrorState onRetry={world.retry} /> : null}

            {isTabletUp && !isDesktop && isPanelCollapsed ? (
                <Button
                    className="absolute top-3 right-3 z-20 shadow-sm"
                    onClick={expandPanel}
                    size="sm"
                    variant="outline"
                >
                    <IconLayoutSidebarLeftExpand data-icon="inline-start" />
                    {t("expand")}
                </Button>
            ) : null}
        </div>
    );
}

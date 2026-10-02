"use client";

import {
    SHEET_HALF_RATIO,
    SHEET_PEEK_HEIGHT_PX,
    SHEET_TOP_GAP_PX,
} from "@/features/travel-explorer/constants/explorer.constants";
import type { SheetSnapPoint } from "@/features/travel-explorer/types/explorer.types";
import { useViewportHeight } from "@/hooks/use-viewport-height";
import { useExplorerUiStore } from "@/stores/explorer-ui-store";

/**
 * Converts a snap point to a pixel height for the given viewport.
 *
 * @param snap - Bottom sheet snap point.
 * @param viewportHeight - Window height in pixels.
 * @returns Sheet height in pixels.
 */
export const getSnapHeight = (snap: SheetSnapPoint, viewportHeight: number): number => {
    if (snap === "peek") {
        return SHEET_PEEK_HEIGHT_PX;
    }
    if (snap === "half") {
        return Math.round(viewportHeight * SHEET_HALF_RATIO);
    }
    return viewportHeight - SHEET_TOP_GAP_PX;
};

/**
 * Height of the phone bottom sheet for the current snap point.
 *
 * @returns Snap point, its height and the viewport height used to compute it.
 */
export function useSheetHeight() {
    const snap = useExplorerUiStore((state) => state.sheetSnap);
    const viewportHeight = useViewportHeight();
    return { height: getSnapHeight(snap, viewportHeight), snap, viewportHeight };
}

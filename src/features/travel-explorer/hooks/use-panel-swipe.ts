"use client";

import { useCallback } from "react";

import { type DragRelease, useDragGesture } from "@/hooks/use-drag-gesture";
import { useExplorerUiStore } from "@/stores/explorer-ui-store";

/** Release speed (px/ms) above which a swipe closes the panel however short it was. */
const FLICK_VELOCITY = 0.4;
/** How far right the panel must be dragged before release closes it. */
const DISMISS_DISTANCE_PX = 96;

/**
 * Swipe-right-to-close for the exploration panel's side drawer. Only touch and pen drive it; a
 * mouse has the panel's hide button.
 *
 * @returns Pointer handlers for the swipe area and the live horizontal offset while swiping.
 */
export function usePanelSwipe() {
    const setPanelOpen = useExplorerUiStore((state) => state.setPanelOpen);

    const handleRelease = useCallback(
        ({ delta, velocity }: DragRelease) => {
            if (delta > DISMISS_DISTANCE_PX || velocity > FLICK_VELOCITY) {
                setPanelOpen(false);
            }
        },
        [setPanelOpen]
    );

    const { dragDelta, handlers } = useDragGesture("x", handleRelease);

    return { dragOffsetX: dragDelta === null ? null : Math.max(dragDelta, 0), handlers };
}

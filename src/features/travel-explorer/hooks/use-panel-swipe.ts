"use client";

import { type MouseEvent, type PointerEvent, useCallback, useRef, useState } from "react";

import {
    SHEET_PEEK_HEIGHT_PX,
    SHEET_SNAP_POINTS,
} from "@/features/travel-explorer/constants/explorer.constants";
import { getSnapHeight, useSheetHeight } from "@/features/travel-explorer/hooks/use-sheet-height";
import type { SheetSnapPoint } from "@/features/travel-explorer/types/explorer.types";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useExplorerUiStore } from "@/stores/explorer-ui-store";

/** Movement below this distance counts as a tap rather than a swipe. */
const SWIPE_THRESHOLD_PX = 8;
/** The click that follows a swipe must not also activate whatever the finger started on. */
const CLICK_AFTER_SWIPE_MS = 300;
/** Release speed (px/ms) above which a swipe moves one snap point in its direction. */
const FLICK_VELOCITY = 0.4;
/** Tablet drawer: how far left it must be dragged before release tucks it away. */
const DRAWER_DISMISS_PX = 96;

type SwipeMode = "sheet" | "drawer";

interface SwipeState {
    isSwiping: boolean;
    lastTime: number;
    lastX: number;
    lastY: number;
    startHeight: number;
    startX: number;
    startY: number;
    velocityX: number;
    velocityY: number;
}

/**
 * Snap point a released sheet settles on: the next one in the flick direction for a fast
 * swipe, otherwise the nearest one.
 *
 * @param releasedHeight - Sheet height at release in pixels.
 * @param velocityY - Vertical release speed in px/ms, positive when moving down.
 * @param viewportHeight - Window height in pixels.
 * @returns Snap point to settle on.
 */
const getReleaseSnap = (
    releasedHeight: number,
    velocityY: number,
    viewportHeight: number
): SheetSnapPoint => {
    const heights = SHEET_SNAP_POINTS.map((snap) => ({
        height: getSnapHeight(snap, viewportHeight),
        snap,
    }));

    if (velocityY > FLICK_VELOCITY) {
        return heights.findLast(({ height }) => height < releasedHeight)?.snap ?? "peek";
    }
    if (velocityY < -FLICK_VELOCITY) {
        return heights.find(({ height }) => height > releasedHeight)?.snap ?? "full";
    }
    return heights.reduce((best, candidate) =>
        Math.abs(candidate.height - releasedHeight) < Math.abs(best.height - releasedHeight)
            ? candidate
            : best
    ).snap;
};

/**
 * Decides whether a pointer that has not started swiping yet should become a swipe.
 *
 * @param mode - Which panel gesture is active.
 * @param deltaX - Horizontal distance from the press point.
 * @param deltaY - Vertical distance from the press point.
 * @returns `start` to begin swiping, `abandon` for a clear move along the other axis, or
 * `wait` while the movement is still too small to tell.
 */
const getSwipeIntent = (
    mode: SwipeMode,
    deltaX: number,
    deltaY: number
): "start" | "abandon" | "wait" => {
    const along = Math.abs(mode === "sheet" ? deltaY : deltaX);
    const across = Math.abs(mode === "sheet" ? deltaX : deltaY);
    if (along >= SWIPE_THRESHOLD_PX) {
        return "start";
    }
    return across >= SWIPE_THRESHOLD_PX ? "abandon" : "wait";
};

/**
 * Records the latest pointer position and the speed since the previous one.
 *
 * @param swipe - Swipe being tracked; updated in place.
 * @param event - Pointer move event.
 */
const trackVelocity = (swipe: SwipeState, event: PointerEvent<HTMLElement>) => {
    const elapsed = event.timeStamp - swipe.lastTime;
    if (elapsed > 0) {
        swipe.velocityX = (event.clientX - swipe.lastX) / elapsed;
        swipe.velocityY = (event.clientY - swipe.lastY) / elapsed;
    }
    swipe.lastTime = event.timeStamp;
    swipe.lastX = event.clientX;
    swipe.lastY = event.clientY;
};

/**
 * Swipe gestures for the exploration panel: dragging the phone bottom sheet between its snap
 * points, and swiping the floating tablet drawer away to the left. Desktop has no gesture.
 *
 * @returns Pointer handlers for the swipe area and the live panel geometry while swiping.
 */
export function usePanelSwipe() {
    const isTabletUp = useMediaQuery("(min-width: 768px)");
    const isDesktop = useMediaQuery("(min-width: 1024px)");
    const { height: snapHeight, viewportHeight } = useSheetHeight();
    const setSheetSnap = useExplorerUiStore((state) => state.setSheetSnap);
    const setPanelCollapsed = useExplorerUiStore((state) => state.setPanelCollapsed);
    const [dragHeight, setDragHeight] = useState<number | null>(null);
    const [dragOffsetX, setDragOffsetX] = useState<number | null>(null);
    const swipeRef = useRef<SwipeState | null>(null);
    const lastSwipeEndRef = useRef(0);

    let mode: SwipeMode | null = null;
    if (!isTabletUp) {
        mode = "sheet";
    } else if (!isDesktop) {
        mode = "drawer";
    }

    const reset = useCallback(() => {
        swipeRef.current = null;
        setDragHeight(null);
        setDragOffsetX(null);
    }, []);

    const onPointerDown = useCallback(
        (event: PointerEvent<HTMLElement>) => {
            if (!mode || event.button !== 0) {
                return;
            }
            swipeRef.current = {
                isSwiping: false,
                lastTime: event.timeStamp,
                lastX: event.clientX,
                lastY: event.clientY,
                startHeight: snapHeight,
                startX: event.clientX,
                startY: event.clientY,
                velocityX: 0,
                velocityY: 0,
            };
        },
        [mode, snapHeight]
    );

    const onPointerMove = useCallback(
        (event: PointerEvent<HTMLElement>) => {
            const swipe = swipeRef.current;
            if (!(swipe && mode)) {
                return;
            }
            const deltaX = event.clientX - swipe.startX;
            const deltaY = event.clientY - swipe.startY;

            if (!swipe.isSwiping) {
                const intent = getSwipeIntent(mode, deltaX, deltaY);
                if (intent === "abandon") {
                    // A clear move along the other axis is not a swipe of this panel.
                    swipeRef.current = null;
                }
                if (intent !== "start") {
                    return;
                }
                swipe.isSwiping = true;
                // Captured only once swiping, so taps still reach the buttons inside the area.
                event.currentTarget.setPointerCapture(event.pointerId);
            }
            trackVelocity(swipe, event);

            if (mode === "sheet") {
                const maxHeight = getSnapHeight("full", viewportHeight);
                setDragHeight(
                    Math.min(Math.max(swipe.startHeight - deltaY, SHEET_PEEK_HEIGHT_PX), maxHeight)
                );
            } else {
                setDragOffsetX(Math.min(deltaX, 0));
            }
        },
        [mode, viewportHeight]
    );

    const onPointerUp = useCallback(
        (event: PointerEvent<HTMLElement>) => {
            const swipe = swipeRef.current;
            reset();
            if (!swipe?.isSwiping) {
                return;
            }
            lastSwipeEndRef.current = performance.now();

            if (mode === "sheet") {
                const releasedHeight = swipe.startHeight - (event.clientY - swipe.startY);
                setSheetSnap(getReleaseSnap(releasedHeight, swipe.velocityY, viewportHeight));
                return;
            }
            const isDismissed =
                swipe.startX - event.clientX > DRAWER_DISMISS_PX ||
                swipe.velocityX < -FLICK_VELOCITY;
            if (isDismissed) {
                setPanelCollapsed(true);
            }
        },
        [mode, reset, setPanelCollapsed, setSheetSnap, viewportHeight]
    );

    const onClickCapture = useCallback((event: MouseEvent<HTMLElement>) => {
        if (performance.now() - lastSwipeEndRef.current < CLICK_AFTER_SWIPE_MS) {
            event.preventDefault();
            event.stopPropagation();
        }
    }, []);

    return {
        dragOffsetX,
        handlers: {
            onClickCapture,
            onPointerCancel: reset,
            onPointerDown,
            onPointerMove,
            onPointerUp,
        },
        isSwipeEnabled: mode !== null,
        isSwiping: dragHeight !== null || dragOffsetX !== null,
        sheetHeight: dragHeight ?? snapHeight,
    };
}

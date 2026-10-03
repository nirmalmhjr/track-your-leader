"use client";

import { type MouseEvent, type PointerEvent, useCallback, useRef, useState } from "react";

import { useExplorerUiStore } from "@/stores/explorer-ui-store";

/** Movement below this distance counts as a tap rather than a swipe. */
const SWIPE_THRESHOLD_PX = 8;
/** The click that follows a swipe must not also activate whatever the finger started on. */
const CLICK_AFTER_SWIPE_MS = 300;
/** Release speed (px/ms) above which a swipe closes the panel however short it was. */
const FLICK_VELOCITY = 0.4;
/** How far right the panel must be dragged before release closes it. */
const DISMISS_DISTANCE_PX = 96;

interface SwipeState {
    isSwiping: boolean;
    lastTime: number;
    lastX: number;
    startX: number;
    startY: number;
    velocityX: number;
}

/**
 * Swipe-right-to-close for the exploration panel. Only touch and pen drive it; a mouse has
 * the panel's hide button.
 *
 * @returns Pointer handlers for the swipe area and the live horizontal offset while swiping.
 */
export function usePanelSwipe() {
    const setPanelOpen = useExplorerUiStore((state) => state.setPanelOpen);
    const [dragOffsetX, setDragOffsetX] = useState<number | null>(null);
    const swipeRef = useRef<SwipeState | null>(null);
    const lastSwipeEndRef = useRef(0);

    const reset = useCallback(() => {
        swipeRef.current = null;
        setDragOffsetX(null);
    }, []);

    const onPointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
        if (event.pointerType === "mouse" || event.button !== 0) {
            return;
        }
        swipeRef.current = {
            isSwiping: false,
            lastTime: event.timeStamp,
            lastX: event.clientX,
            startX: event.clientX,
            startY: event.clientY,
            velocityX: 0,
        };
    }, []);

    const onPointerMove = useCallback((event: PointerEvent<HTMLElement>) => {
        const swipe = swipeRef.current;
        if (!swipe) {
            return;
        }
        const deltaX = event.clientX - swipe.startX;

        if (!swipe.isSwiping) {
            if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) {
                // A clear vertical move is not a swipe of this panel.
                if (Math.abs(event.clientY - swipe.startY) >= SWIPE_THRESHOLD_PX) {
                    swipeRef.current = null;
                }
                return;
            }
            swipe.isSwiping = true;
            // Captured only once swiping, so taps still reach the buttons inside the area.
            event.currentTarget.setPointerCapture(event.pointerId);
        }

        const elapsed = event.timeStamp - swipe.lastTime;
        if (elapsed > 0) {
            swipe.velocityX = (event.clientX - swipe.lastX) / elapsed;
        }
        swipe.lastTime = event.timeStamp;
        swipe.lastX = event.clientX;
        setDragOffsetX(Math.max(deltaX, 0));
    }, []);

    const onPointerUp = useCallback(
        (event: PointerEvent<HTMLElement>) => {
            const swipe = swipeRef.current;
            reset();
            if (!swipe?.isSwiping) {
                return;
            }
            lastSwipeEndRef.current = performance.now();
            const isDismissed =
                event.clientX - swipe.startX > DISMISS_DISTANCE_PX ||
                swipe.velocityX > FLICK_VELOCITY;
            if (isDismissed) {
                setPanelOpen(false);
            }
        },
        [reset, setPanelOpen]
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
    };
}

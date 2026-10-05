"use client";

import { type MouseEvent, type PointerEvent, useCallback, useRef, useState } from "react";

/** Movement below this distance counts as a tap rather than a drag. */
const DRAG_THRESHOLD_PX = 8;
/** The click that follows a drag must not also activate whatever the finger started on. */
const CLICK_AFTER_DRAG_MS = 300;

export type DragAxis = "x" | "y";

/** How a finished drag ended, measured along the gesture's axis. */
export interface DragRelease {
    /** Distance moved since the drag started (px), positive towards the right or bottom. */
    delta: number;
    /** Speed at release (px/ms), positive towards the right or bottom. */
    velocity: number;
}

interface DragState {
    isDragging: boolean;
    last: number;
    lastTime: number;
    start: number;
    startCross: number;
    velocity: number;
}

/** Position of a pointer along the drag axis, then across it. */
const readPosition = (event: PointerEvent<HTMLElement>, axis: DragAxis): [number, number] =>
    axis === "x" ? [event.clientX, event.clientY] : [event.clientY, event.clientX];

/**
 * Touch and pen drags along one axis, for panels a finger moves. A clear move across the axis is
 * left to the browser (scrolling); a mouse is ignored, since it has the panel's buttons.
 *
 * @param axis - Axis the drag follows.
 * @param onRelease - Called when a drag, not a tap, ends.
 * @returns Pointer handlers for the drag area and the live distance moved (`null` when idle).
 */
export function useDragGesture(axis: DragAxis, onRelease: (release: DragRelease) => void) {
    const [dragDelta, setDragDelta] = useState<number | null>(null);
    const dragRef = useRef<DragState | null>(null);
    const lastDragEndRef = useRef(0);

    const reset = useCallback(() => {
        dragRef.current = null;
        setDragDelta(null);
    }, []);

    const onPointerDown = useCallback(
        (event: PointerEvent<HTMLElement>) => {
            if (event.pointerType === "mouse" || event.button !== 0) {
                return;
            }
            const [position, cross] = readPosition(event, axis);
            dragRef.current = {
                isDragging: false,
                last: position,
                lastTime: event.timeStamp,
                start: position,
                startCross: cross,
                velocity: 0,
            };
        },
        [axis]
    );

    const onPointerMove = useCallback(
        (event: PointerEvent<HTMLElement>) => {
            const drag = dragRef.current;
            if (!drag) {
                return;
            }
            const [position, cross] = readPosition(event, axis);
            const delta = position - drag.start;

            if (!drag.isDragging) {
                if (Math.abs(delta) < DRAG_THRESHOLD_PX) {
                    // A clear move across the axis is not a drag of this element.
                    if (Math.abs(cross - drag.startCross) >= DRAG_THRESHOLD_PX) {
                        dragRef.current = null;
                    }
                    return;
                }
                drag.isDragging = true;
                // Captured only once dragging, so taps still reach the buttons inside the area.
                event.currentTarget.setPointerCapture(event.pointerId);
            }

            const elapsed = event.timeStamp - drag.lastTime;
            if (elapsed > 0) {
                drag.velocity = (position - drag.last) / elapsed;
            }
            drag.lastTime = event.timeStamp;
            drag.last = position;
            setDragDelta(delta);
        },
        [axis]
    );

    const onPointerUp = useCallback(
        (event: PointerEvent<HTMLElement>) => {
            const drag = dragRef.current;
            reset();
            if (!drag?.isDragging) {
                return;
            }
            lastDragEndRef.current = performance.now();
            const [position] = readPosition(event, axis);
            onRelease({ delta: position - drag.start, velocity: drag.velocity });
        },
        [axis, onRelease, reset]
    );

    const onClickCapture = useCallback((event: MouseEvent<HTMLElement>) => {
        if (performance.now() - lastDragEndRef.current < CLICK_AFTER_DRAG_MS) {
            event.preventDefault();
            event.stopPropagation();
        }
    }, []);

    return {
        dragDelta,
        handlers: {
            onClickCapture,
            onPointerCancel: reset,
            onPointerDown,
            onPointerMove,
            onPointerUp,
        },
    };
}

"use client";

import { useCallback } from "react";

/** How long the pointer must rest before a highlight changes. */
const HOVER_INTENT_DELAY_MS = 120;

type SetHighlight<T> = (value: T | null) => void;

/**
 * One pending highlight change for the whole panel. Moving from one row to the next replaces
 * the pending "clear" with the new row, so the map never flashes back to its unfocused state
 * in between, and rows sliding under a still pointer while scrolling change nothing.
 */
let pending: { setHighlight: SetHighlight<never>; timer: ReturnType<typeof setTimeout> } | null =
    null;

const cancelPending = (nextSetHighlight: SetHighlight<never> | null) => {
    if (!pending) {
        return;
    }
    clearTimeout(pending.timer);
    // A highlight of another kind (a country, a trip) must not outlive the row that set it.
    if (pending.setHighlight !== nextSetHighlight) {
        pending.setHighlight(null);
    }
    pending = null;
};

const schedule = <T>(setHighlight: SetHighlight<T>, value: T | null) => {
    cancelPending(setHighlight);
    const timer = setTimeout(() => {
        pending = null;
        setHighlight(value);
    }, HOVER_INTENT_DELAY_MS);
    pending = { setHighlight, timer };
};

/** Drops a pending highlight change, e.g. when navigation unmounts the rows. */
export const cancelHoverHighlight = (): void => cancelPending(null);

/**
 * Handlers that highlight a panel row on the map while it is pointed at or focused. Pointer
 * highlights wait for the pointer to rest briefly; keyboard focus highlights straight away.
 *
 * @param setHighlight - Store setter for the highlight (stable across renders).
 * @param value - What the row highlights.
 * @returns Pointer and focus handlers to spread on the row's interactive element.
 */
export function useHoverHighlight<T>(setHighlight: SetHighlight<T>, value: T) {
    const onPointerEnter = useCallback(() => schedule(setHighlight, value), [setHighlight, value]);
    const onPointerLeave = useCallback(() => schedule(setHighlight, null), [setHighlight]);
    const onFocus = useCallback(() => {
        cancelPending(setHighlight);
        setHighlight(value);
    }, [setHighlight, value]);
    const onBlur = useCallback(() => {
        cancelPending(setHighlight);
        setHighlight(null);
    }, [setHighlight]);

    return { onBlur, onFocus, onPointerEnter, onPointerLeave };
}

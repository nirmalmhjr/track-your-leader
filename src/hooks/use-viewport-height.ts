"use client";

import { useSyncExternalStore } from "react";

const subscribe = (onChange: () => void) => {
    window.addEventListener("resize", onChange);
    return () => window.removeEventListener("resize", onChange);
};

/** Fallback used during server rendering, roughly a phone's visible height. */
const SERVER_VIEWPORT_HEIGHT = 800;

/**
 * Tracks the window's inner height, which reflects mobile browser chrome changes.
 *
 * @returns Current viewport height in CSS pixels.
 */
export function useViewportHeight(): number {
    return useSyncExternalStore(
        subscribe,
        () => window.innerHeight,
        () => SERVER_VIEWPORT_HEIGHT
    );
}

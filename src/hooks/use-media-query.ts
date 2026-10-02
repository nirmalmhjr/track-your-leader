"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Subscribes to a CSS media query.
 *
 * @param query - Media query string, e.g. `(min-width: 768px)`.
 * @param serverValue - Value assumed during server rendering and hydration.
 * @returns Whether the query currently matches.
 */
export function useMediaQuery(query: string, serverValue = false): boolean {
    const subscribe = useCallback(
        (onChange: () => void) => {
            const mediaQueryList = window.matchMedia(query);
            mediaQueryList.addEventListener("change", onChange);
            return () => mediaQueryList.removeEventListener("change", onChange);
        },
        [query]
    );

    return useSyncExternalStore(
        subscribe,
        () => window.matchMedia(query).matches,
        () => serverValue
    );
}

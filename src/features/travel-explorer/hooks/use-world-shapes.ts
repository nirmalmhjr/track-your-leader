"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
    buildCountryShapes,
    loadWorldTopology,
    type MapCountryShape,
} from "@/features/travel-explorer/utils/map-geometry.utils";

type WorldShapesState =
    | { status: "loading" }
    | { status: "error" }
    | { status: "ready"; shapes: readonly MapCountryShape[] };

let cachedShapes: readonly MapCountryShape[] | null = null;

const initialState = (): WorldShapesState =>
    cachedShapes ? { shapes: cachedShapes, status: "ready" } : { status: "loading" };

/**
 * Loads the world topology on demand and converts it into country shapes, keeping the result
 * for later mounts.
 *
 * @returns Loading state, the shapes once ready, and a retry callback for failures.
 */
export function useWorldShapes() {
    const [state, setState] = useState<WorldShapesState>(initialState);
    /** Incremented per request and on unmount so stale responses are ignored. */
    const requestIdRef = useRef(0);

    const load = useCallback(async () => {
        requestIdRef.current += 1;
        const requestId = requestIdRef.current;
        setState({ status: "loading" });
        try {
            const topology = await loadWorldTopology();
            cachedShapes ??= buildCountryShapes(topology);
            const shapes = cachedShapes;
            if (requestId === requestIdRef.current) {
                setState({ shapes, status: "ready" });
            }
        } catch {
            if (requestId === requestIdRef.current) {
                setState({ status: "error" });
            }
        }
    }, []);

    useEffect(() => {
        if (!cachedShapes) {
            load();
        }
        return () => {
            requestIdRef.current += 1;
        };
    }, [load]);

    return { ...state, retry: load };
}

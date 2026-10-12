"use client";

import { memo, useMemo } from "react";

import {
    continentGradientId,
    getContinentExtents,
} from "@/features/travel-explorer/utils/map-continents.utils";
import type { MapCountryShape } from "@/features/travel-explorer/utils/map-geometry.utils";

/**
 * One fade per continent, bright at its north and deep at its south, in map units. The theme
 * points `--map-land-<continent>` at these; the colours come from `--map-continent-top`,
 * `--map-continent-bottom` (pastel in light mode, deeper in dark) and `--map-hue-<continent>`.
 */
export const MapContinentGradients = memo(function ContinentGradients({
    shapes,
}: {
    shapes: readonly MapCountryShape[];
}) {
    const extents = useMemo(() => [...getContinentExtents(shapes)], [shapes]);

    return (
        <defs>
            {extents.map(([continent, { top, bottom }]) => (
                <linearGradient
                    gradientUnits="userSpaceOnUse"
                    id={continentGradientId(continent)}
                    key={continent}
                    x1={0}
                    x2={0}
                    y1={top}
                    y2={bottom}
                >
                    <stop
                        offset={0}
                        style={{
                            stopColor: `oklch(var(--map-continent-top) var(--map-hue-${continent}))`,
                        }}
                    />
                    <stop
                        offset={1}
                        style={{
                            stopColor: `oklch(var(--map-continent-bottom) var(--map-hue-${continent}))`,
                        }}
                    />
                </linearGradient>
            ))}
        </defs>
    );
});

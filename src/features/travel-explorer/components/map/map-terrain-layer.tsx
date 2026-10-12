"use client";

import type { ZoomTransform } from "d3-zoom";

import { MAP_CONFIG } from "@/features/travel-explorer/constants/explorer.constants";
import type { Bounds } from "@/features/travel-explorer/utils/map-geometry.utils";
import {
    getTerrainTiles,
    pickTerrainLevel,
    WORLD_BOUNDS,
} from "@/features/travel-explorer/utils/terrain-tiles.utils";

interface MapTerrainLayerProps {
    height: number;
    transform: ZoomTransform;
    width: number;
}

/**
 * Terrain imagery in map units, drawn under the countries. The coarsest level always covers the
 * whole map, so nothing flashes empty while the sharper tiles in view load on top of it.
 */
export function MapTerrainLayer({ transform, width, height }: MapTerrainLayerProps) {
    const pixelRatio = typeof window === "undefined" ? 1 : window.devicePixelRatio;
    const level = pickTerrainLevel(MAP_CONFIG.worldWidth * transform.k * pixelRatio);
    const view: Bounds = [
        [transform.invertX(0), transform.invertY(0)],
        [transform.invertX(width), transform.invertY(height)],
    ];
    const tiles =
        level === 0
            ? getTerrainTiles(0, WORLD_BOUNDS)
            : [...getTerrainTiles(0, WORLD_BOUNDS), ...getTerrainTiles(level, view)];

    return (
        <g aria-hidden className="pointer-events-none">
            {tiles.map((tile) => (
                <image
                    height={tile.size}
                    href={tile.url}
                    key={tile.url}
                    preserveAspectRatio="none"
                    width={tile.size}
                    x={tile.x}
                    y={tile.y}
                />
            ))}
        </g>
    );
}

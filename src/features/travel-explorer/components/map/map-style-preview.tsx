"use client";

import { IconMap, IconMountain } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { memo, useCallback } from "react";

import {
    getMapContinent,
    type MapContinent,
} from "@/features/travel-explorer/utils/map-continents.utils";
import type { Bounds, MapCountryShape } from "@/features/travel-explorer/utils/map-geometry.utils";
import { getTerrainTiles } from "@/features/travel-explorer/utils/terrain-tiles.utils";
import { useExplorerUiStore } from "@/stores/explorer-ui-store";

/** India and the Himalayas, in map units: lowlands, desert, mountains and sea in one square. */
const PREVIEW_VIEW: Bounds = [
    [640, 326],
    [770, 456],
];
const [[VIEW_X, VIEW_Y], [VIEW_RIGHT, VIEW_BOTTOM]] = PREVIEW_VIEW;
const VIEW_BOX = `${VIEW_X} ${VIEW_Y} ${VIEW_RIGHT - VIEW_X} ${VIEW_BOTTOM - VIEW_Y}`;
/** The coarsest terrain level is sharp enough for the small preview, and one tile covers it. */
const TERRAIN_PREVIEW_TILES = getTerrainTiles(0, PREVIEW_VIEW);

/**
 * A country's colour on the flat map: its continent's land where the theme colours continents,
 * otherwise plain land from the root, which the terrain style can't clear.
 */
const plainContinentFill = (continent: MapContinent | null): string =>
    continent ? `var(--map-land-${continent}, var(--map-plain-land))` : "var(--map-plain-land)";

/** The flat map's look, in its own colours even while the terrain style is on. */
const PlainPreview = memo(function FlatMapPreview({
    shapes,
}: {
    shapes: readonly MapCountryShape[];
}) {
    return (
        <>
            <rect
                className="fill-(--map-plain-ocean)"
                height={VIEW_BOTTOM - VIEW_Y}
                width={VIEW_RIGHT - VIEW_X}
                x={VIEW_X}
                y={VIEW_Y}
            />
            {shapes.map((shape) => (
                <path
                    className="stroke-(--map-plain-border) [stroke-width:0.5] [vector-effect:non-scaling-stroke]"
                    d={shape.path}
                    fill={plainContinentFill(getMapContinent(shape.reference))}
                    key={shape.key}
                />
            ))}
        </>
    );
});

interface MapStylePreviewProps {
    bottom: number;
    left: number;
    shapes: readonly MapCountryShape[];
}

/**
 * Corner switch between the flat map and the terrain imagery, as on Google Maps: a small picture
 * of the other look, so visitors see what they will get before clicking.
 */
export function MapStylePreview({ shapes, left, bottom }: MapStylePreviewProps) {
    const t = useTranslations("Explorer.map.controls");
    const isTerrain = useExplorerUiStore((state) => state.mapStyle === "terrain");
    const setMapStyle = useExplorerUiStore((state) => state.setMapStyle);
    const handleClick = useCallback(
        () => setMapStyle(isTerrain ? "simple" : "terrain"),
        [isTerrain, setMapStyle]
    );

    return (
        <button
            aria-label={isTerrain ? t("showMap") : t("showTerrain")}
            className="absolute z-10 size-16 overflow-hidden rounded-lg border-2 border-white shadow-md outline-none transition-[bottom,scale] duration-300 hover:scale-105 focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
            onClick={handleClick}
            style={{ bottom, left }}
            type="button"
        >
            <svg
                aria-hidden
                className="block size-full"
                preserveAspectRatio="xMidYMid slice"
                viewBox={VIEW_BOX}
            >
                {isTerrain ? (
                    <PlainPreview shapes={shapes} />
                ) : (
                    TERRAIN_PREVIEW_TILES.map((tile) => (
                        <image
                            height={tile.size}
                            href={tile.url}
                            key={tile.url}
                            width={tile.size}
                            x={tile.x}
                            y={tile.y}
                        />
                    ))
                )}
            </svg>
            <span
                aria-hidden
                className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-linear-to-t from-black/75 to-transparent pt-3 pb-1 font-semibold text-[11px] text-white"
            >
                {isTerrain ? <IconMap className="size-3" /> : <IconMountain className="size-3" />}
                {isTerrain ? t("map") : t("terrain")}
            </span>
        </button>
    );
}

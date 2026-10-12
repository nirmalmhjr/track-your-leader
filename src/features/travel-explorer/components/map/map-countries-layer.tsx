"use client";

import { type CSSProperties, memo } from "react";

import { MapCountryOutline } from "@/features/travel-explorer/components/map/map-country-outline";
import { COUNTRY_FILLS } from "@/features/travel-explorer/constants/map-style.constants";
import type { MapCountryShape } from "@/features/travel-explorer/utils/map-geometry.utils";
import { cn } from "@/lib/utils";

interface MapCountriesLayerProps {
    fills: ReadonlyMap<string, string>;
    highlightedKey: string | null;
    selectedKey: string | null;
    shapes: readonly MapCountryShape[];
}

/**
 * Hovered land darkens towards the ink, or takes the theme's own hover colour where land is a
 * fade, which a colour mix can't take.
 */
const HOVER_FILL =
    "hover:fill-[var(--map-hover-fill,color-mix(in_oklab,var(--country-fill)_82%,var(--map-ink)))]";

/**
 * Country polygons in map units. Rendered once per data change and transformed as a group
 * during pan and zoom; strokes stay hairline thanks to `non-scaling-stroke`.
 */
export const MapCountriesLayer = memo(function CountriesLayer({
    shapes,
    fills,
    selectedKey,
    highlightedKey,
}: MapCountriesLayerProps) {
    const selectedShape = shapes.find((shape) => shape.key === selectedKey);
    const highlightedShape =
        highlightedKey === selectedKey
            ? undefined
            : shapes.find((shape) => shape.key === highlightedKey);

    return (
        <g aria-hidden>
            {shapes.map((shape) => {
                const isInteractive = shape.reference !== null;
                return (
                    <path
                        className={cn(
                            "fill-(--country-fill) stroke-(--map-border) transition-[fill] duration-300 [stroke-width:0.6] [vector-effect:non-scaling-stroke]",
                            isInteractive && ["cursor-pointer", HOVER_FILL]
                        )}
                        d={shape.path}
                        data-country={isInteractive ? shape.key : undefined}
                        key={shape.key}
                        style={
                            {
                                "--country-fill": fills.get(shape.key) ?? COUNTRY_FILLS.land,
                            } as CSSProperties
                        }
                    />
                );
            })}
            {highlightedShape ? (
                <MapCountryOutline path={highlightedShape.path} variant="hover" />
            ) : null}
            {selectedShape ? (
                <MapCountryOutline path={selectedShape.path} variant="selected" />
            ) : null}
        </g>
    );
});

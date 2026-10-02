"use client";

import { type CSSProperties, memo } from "react";

import { COUNTRY_FILLS } from "@/features/travel-explorer/constants/map-style.constants";
import type { MapCountryShape } from "@/features/travel-explorer/utils/map-geometry.utils";
import { cn } from "@/lib/utils";

interface MapCountriesLayerProps {
    fills: ReadonlyMap<string, string>;
    highlightedKey: string | null;
    selectedKey: string | null;
    shapes: readonly MapCountryShape[];
}

const HOVER_FILL = "hover:fill-[color-mix(in_oklab,var(--country-fill)_82%,var(--map-ink))]";

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
                <path
                    className="pointer-events-none fill-none stroke-(--map-ink) [stroke-width:1.25] [vector-effect:non-scaling-stroke]"
                    d={highlightedShape.path}
                />
            ) : null}
            {selectedShape ? (
                <path
                    className="pointer-events-none fill-none stroke-(--map-selected-border) [stroke-width:1.5] [vector-effect:non-scaling-stroke]"
                    d={selectedShape.path}
                />
            ) : null}
        </g>
    );
});

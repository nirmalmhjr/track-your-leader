"use client";

import { memo, useId } from "react";

import { MapCountryOutline } from "@/features/travel-explorer/components/map/map-country-outline";
import type { Bounds, MapCountryShape } from "@/features/travel-explorer/utils/map-geometry.utils";
import { useFlagImageUrl } from "@/hooks/use-flag-image-url";

/** Flags that are not rectangles; they are fitted whole rather than cropped. */
const NON_RECTANGULAR_FLAGS = new Set(["np"]);
/** Aspect ratio of the bundled flag artwork. */
const FLAG_ASPECT = 4 / 3;

/**
 * Sizes a 4:3 box around the country's body: covering it (cropping the flag's edges) or, for
 * non-rectangular flags, fitting inside it. Doing this explicitly is reliable across browsers,
 * which disagree on `preserveAspectRatio` for SVG images.
 */
const fitFlagBox = (bounds: Bounds, mode: "cover" | "contain") => {
    const [[x0, y0], [x1, y1]] = bounds;
    const boxWidth = x1 - x0;
    const boxHeight = y1 - y0;
    const isWiderThanFlag = boxWidth / boxHeight > FLAG_ASPECT;
    const fitToWidth = mode === "cover" ? isWiderThanFlag : !isWiderThanFlag;
    const width = fitToWidth ? boxWidth : boxHeight * FLAG_ASPECT;
    const height = fitToWidth ? boxWidth / FLAG_ASPECT : boxHeight;
    return {
        height,
        width,
        x: x0 + (boxWidth - width) / 2,
        y: y0 + (boxHeight - height) / 2,
    };
};

interface MapFlagFillProps {
    shape: MapCountryShape;
    /** `selected` shows the flag fully; `preview` is the lighter hover state. */
    variant: "selected" | "preview";
}

/**
 * Paints a country's flag inside its borders. The image covers the country's main body and is
 * clipped to the exact outline, so the flag follows the real geographic shape.
 */
export const MapFlagFill = memo(function FlagFill({ shape, variant }: MapFlagFillProps) {
    const clipId = useId();
    const alpha2 = shape.reference?.alpha2.toLowerCase() ?? null;
    const url = useFlagImageUrl(alpha2);

    if (!(url && alpha2)) {
        return null;
    }

    const box = fitFlagBox(shape.bounds, NON_RECTANGULAR_FLAGS.has(alpha2) ? "contain" : "cover");
    const isSelected = variant === "selected";

    return (
        <g aria-hidden className="pointer-events-none">
            <clipPath id={clipId}>
                <path d={shape.path} />
            </clipPath>
            <image
                className="fade-in animate-in duration-300 motion-reduce:animate-none"
                clipPath={`url(#${clipId})`}
                height={box.height}
                href={url}
                opacity={isSelected ? 0.95 : 0.85}
                width={box.width}
                x={box.x}
                y={box.y}
            />
            {isSelected ? (
                <MapCountryOutline path={shape.path} variant="selected" />
            ) : (
                <path
                    className="fill-none stroke-(--map-hover-border) [stroke-opacity:0.6] [stroke-width:1] [vector-effect:non-scaling-stroke]"
                    d={shape.path}
                />
            )}
        </g>
    );
});

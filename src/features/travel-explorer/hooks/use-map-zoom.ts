"use client";

import { select } from "d3-selection";
import "d3-transition";
import { type ZoomBehavior, type ZoomTransform, zoom, zoomIdentity } from "d3-zoom";
import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MAP_CONFIG } from "@/features/travel-explorer/constants/explorer.constants";
import {
    type Bounds,
    MAP_WORLD_HEIGHT,
    projectCoordinates,
} from "@/features/travel-explorer/utils/map-geometry.utils";
import { useMediaQuery } from "@/hooks/use-media-query";

export interface MapInsets {
    bottom: number;
    left: number;
    right: number;
    top: number;
}

interface UseMapZoomOptions {
    height: number;
    /** Screen space covered by panels and the top overlay, excluded when framing content. */
    insets: MapInsets;
    svgRef: RefObject<SVGSVGElement | null>;
    width: number;
}

/** Inhabited latitudes; the polar caps are left out of the home view. */
const HOME_NORTH_LATITUDE = 78;
const HOME_SOUTH_LATITUDE = -56;
const PORTRAIT_HEIGHT_FILL = 0.5;
/**
 * Room kept free for the zoom controls when framing a selection. The home view ignores it so
 * the world stays centred between the panels.
 */
const ZOOM_CONTROLS_RESERVE_PX = 44;
const CLICK_TOLERANCE_PX = 4;
const KEYBOARD_ZOOM_MS = 220;
/** Matches the panel's slide, so the map glides along when the panel opens or closes. */
const PANEL_FOLLOW_MS = 300;
/** How far past the world's edges the map may be panned, in map units. */
const PAN_MARGIN = MAP_CONFIG.worldWidth * 0.3;

const homeTop = projectCoordinates([0, HOME_NORTH_LATITUDE])?.[1] ?? 0;
const homeBottom = projectCoordinates([0, HOME_SOUTH_LATITUDE])?.[1] ?? MAP_WORLD_HEIGHT;
const homeHeight = homeBottom - homeTop;

/**
 * The resting view: the whole world centred in the area beside the panel. Vertically it is
 * centred on the inhabited latitudes with equal gaps above and below, so the map sits in the
 * middle of the screen rather than being pushed down by the overlays along the top.
 */
const computeHomeTransform = (width: number, height: number, insets: MapInsets): ZoomTransform => {
    const verticalGap = Math.min(insets.top, insets.bottom);
    const availableWidth = Math.max(width - insets.left - insets.right, 1);
    const availableHeight = Math.max(height - 2 * verticalGap, 1);
    const containScale = Math.min(
        availableWidth / MAP_CONFIG.worldWidth,
        availableHeight / homeHeight
    );
    const isPortrait = availableWidth < availableHeight;
    const scale = isPortrait
        ? Math.max(containScale, (availableHeight * PORTRAIT_HEIGHT_FILL) / homeHeight)
        : containScale;

    const centerX = MAP_CONFIG.worldWidth / 2;
    const centerY = homeTop + homeHeight / 2;

    return zoomIdentity
        .translate(insets.left + availableWidth / 2 - scale * centerX, height / 2 - scale * centerY)
        .scale(scale);
};

/**
 * Pan limits: the world plus a margin, widened to everything the home view shows so d3-zoom
 * never snaps the home view sideways on the first drag when a panel shifts it off-centre.
 */
const computeTranslateExtent = (
    home: ZoomTransform,
    width: number,
    height: number
): [[number, number], [number, number]] => {
    const [viewLeft, viewTop] = home.invert([0, 0]);
    const [viewRight, viewBottom] = home.invert([width, height]);
    return [
        [Math.min(-PAN_MARGIN, viewLeft), Math.min(-PAN_MARGIN, viewTop)],
        [
            Math.max(MAP_CONFIG.worldWidth + PAN_MARGIN, viewRight),
            Math.max(MAP_WORLD_HEIGHT + PAN_MARGIN, viewBottom),
        ],
    ];
};

type CameraMode = "home" | "framed" | "free";

/**
 * Wires d3-zoom to the map SVG while keeping the transform in React state, so overlays that
 * live in screen space (routes, labels, callouts) can be positioned from the same value.
 *
 * @param options - SVG ref, viewport size and the insets covered by panels.
 * @returns The current transform and imperative camera controls.
 */
export function useMapZoom({ svgRef, width, height, insets }: UseMapZoomOptions) {
    const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
    const behaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
    /**
     * What the camera is showing, so viewport changes (resizes, panels opening) keep the
     * intent: the home view and framed selections adapt, while a view the user moved stays put.
     */
    const cameraModeRef = useRef<CameraMode>("home");
    /** Viewport size the home view was last applied at; `null` before the first apply. */
    const homeSizeRef = useRef<string | null>(null);
    const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);

    const home = useMemo(
        () => computeHomeTransform(width, height, insets),
        [width, height, insets]
    );

    useEffect(() => {
        const svg = svgRef.current;
        if (!svg) {
            return;
        }

        const behavior = zoom<SVGSVGElement, unknown>()
            .clickDistance(CLICK_TOLERANCE_PX)
            .on("zoom", (event: { transform: ZoomTransform; sourceEvent: unknown }) => {
                if (event.sourceEvent) {
                    cameraModeRef.current = "free";
                }
                setTransform(event.transform);
            });

        behaviorRef.current = behavior;
        select(svg).call(behavior);

        return () => {
            select(svg).on(".zoom", null);
            behaviorRef.current = null;
        };
    }, [svgRef]);

    useEffect(() => {
        const svg = svgRef.current;
        const behavior = behaviorRef.current;
        if (!(svg && behavior) || width === 0 || height === 0) {
            return;
        }

        behavior
            .extent([
                [0, 0],
                [width, height],
            ])
            .scaleExtent([home.k * 0.85, home.k * MAP_CONFIG.maxZoom])
            .translateExtent(computeTranslateExtent(home, width, height));

        if (cameraModeRef.current !== "home") {
            return;
        }
        // Panels opening or closing glide the map along; resizes and the first view snap.
        const sizeKey = `${width}x${height}`;
        const isPanelChange = homeSizeRef.current === sizeKey;
        homeSizeRef.current = sizeKey;
        if (isPanelChange && !prefersReducedMotion) {
            select(svg).transition().duration(PANEL_FOLLOW_MS).call(behavior.transform, home);
        } else {
            select(svg).call(behavior.transform, home);
        }
    }, [svgRef, width, height, home, prefersReducedMotion]);

    const applyTransform = useCallback(
        (target: ZoomTransform, durationMs: number = MAP_CONFIG.transitionMs) => {
            const svg = svgRef.current;
            const behavior = behaviorRef.current;
            if (!(svg && behavior)) {
                return;
            }

            if (prefersReducedMotion || durationMs === 0) {
                select(svg).call(behavior.transform, target);
                return;
            }

            select(svg).transition().duration(durationMs).call(behavior.transform, target);
        },
        [svgRef, prefersReducedMotion]
    );

    const visibleCenter = useCallback((): [number, number] => {
        const availableWidth = width - insets.left - insets.right;
        const availableHeight = height - insets.top - insets.bottom;
        return [insets.left + availableWidth / 2, insets.top + availableHeight / 2];
    }, [width, height, insets]);

    const zoomBy = useCallback(
        (factor: number) => {
            const svg = svgRef.current;
            const behavior = behaviorRef.current;
            if (!(svg && behavior)) {
                return;
            }

            cameraModeRef.current = "free";
            const selection = select(svg);
            if (prefersReducedMotion) {
                selection.call(behavior.scaleBy, factor, visibleCenter());
                return;
            }
            selection
                .transition()
                .duration(KEYBOARD_ZOOM_MS)
                .call(behavior.scaleBy, factor, visibleCenter());
        },
        [svgRef, prefersReducedMotion, visibleCenter]
    );

    const panBy = useCallback(
        (dx: number, dy: number) => {
            const svg = svgRef.current;
            const behavior = behaviorRef.current;
            if (!(svg && behavior)) {
                return;
            }
            cameraModeRef.current = "free";
            const current = select(svg).property("__zoom") as ZoomTransform;
            select(svg).call(behavior.translateBy, dx / current.k, dy / current.k);
        },
        [svgRef]
    );

    const fitBounds = useCallback(
        (bounds: Bounds, maxZoom: number = MAP_CONFIG.maxAutoFitZoom) => {
            const [[x0, y0], [x1, y1]] = bounds;
            const availableWidth = Math.max(
                width - insets.left - insets.right - ZOOM_CONTROLS_RESERVE_PX,
                1
            );
            const availableHeight = Math.max(height - insets.top - insets.bottom, 1);
            const boundsWidth = Math.max(x1 - x0, 1);
            const boundsHeight = Math.max(y1 - y0, 1);

            const fitted =
                Math.min(availableWidth / boundsWidth, availableHeight / boundsHeight) *
                MAP_CONFIG.fitFill;
            const scale = Math.min(Math.max(fitted, home.k), home.k * maxZoom);
            const centerX = (x0 + x1) / 2;
            const centerY = (y0 + y1) / 2;

            cameraModeRef.current = "framed";
            applyTransform(
                zoomIdentity
                    .translate(
                        insets.left + availableWidth / 2 - scale * centerX,
                        insets.top + availableHeight / 2 - scale * centerY
                    )
                    .scale(scale)
            );
        },
        [width, height, insets, home, applyTransform]
    );

    const resetView = useCallback(() => {
        cameraModeRef.current = "home";
        applyTransform(home);
    }, [applyTransform, home]);

    const getCameraMode = useCallback(() => cameraModeRef.current, []);

    return { fitBounds, getCameraMode, home, panBy, resetView, transform, zoomBy };
}

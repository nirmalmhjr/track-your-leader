"use client";

import type { ZoomTransform } from "d3-zoom";
import { memo, useCallback, useId, useMemo } from "react";

import { MAP_CONFIG } from "@/features/travel-explorer/constants/explorer.constants";
import {
    DIMMED_ROUTE_OPACITY,
    ROUTE_STYLES,
} from "@/features/travel-explorer/constants/map-style.constants";
import { useExplorerFormat } from "@/features/travel-explorer/hooks/use-explorer-format";
import type { Place, TravelRecord } from "@/features/travel-explorer/types/travel.types";
import {
    buildArcPath,
    type Point,
    projectCoordinates,
    type ScreenBox,
} from "@/features/travel-explorer/utils/map-geometry.utils";
import type {
    MapNode,
    MapScene,
    RouteSegment,
    RouteTone,
} from "@/features/travel-explorer/utils/map-scene.utils";

interface RouteFocus {
    /** Official whose routes to emphasise (hovered card). */
    officialId: string | null;
    /** Trip to emphasise (selected or hovered). */
    recordId: string | null;
}

interface MapRoutesLayerProps {
    focus: RouteFocus;
    height: number;
    /** Screen areas labels must keep clear of (the callout, a small selected country). */
    labelObstacles: readonly ScreenBox[];
    scene: MapScene;
    /** Outline (map units) of the selected country; routes fade over it so its flag stays clear. */
    selectedPath: string | null;
    transform: ZoomTransform;
    width: number;
}

interface LabelBox {
    height: number;
    width: number;
    x: number;
    y: number;
}

/** Future routes bow higher and cancelled ones lower, so parallel routes stay distinguishable. */
const LIFT_BY_TONE: Readonly<Record<RouteTone, number>> = {
    cancelled: 0.7,
    future: 1.35,
    past: 1,
};

const LABEL_HEIGHT = 14;
const LABEL_CHAR_WIDTH = 6.2;
const LABEL_GAP = 5;
const VIEWPORT_MARGIN = 24;

/** Mask luminance over the selected country: routes keep about a quarter of their strength. */
const SELECTED_ROUTE_VISIBILITY = 64;
/** Extra stroke width of the routes the hover focus emphasises. */
const FOCUSED_EXTRA_WIDTH = 0.75;
/** Endpoints stay a little more visible than routes when another official is in focus. */
const DIMMED_NODE_OPACITY = DIMMED_ROUTE_OPACITY + 0.15;

const nodeRadius = (node: MapNode): number =>
    3.5 + Math.min(Math.sqrt(node.records.length) * 1.1, 4.5);

const matchesFocus = (records: readonly TravelRecord[], focus: RouteFocus): boolean => {
    if (focus.recordId) {
        return records.some((record) => record.id === focus.recordId);
    }
    if (focus.officialId) {
        return records.some((record) => record.officialId === focus.officialId);
    }
    return true;
};

const overlaps = (a: LabelBox, b: LabelBox): boolean =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

function NodeMarker({ node, point }: { node: MapNode; point: Point }) {
    const radius = nodeRadius(node);
    const [x, y] = point;
    const hasUpcoming = node.records.some(
        (record) => record.status === "upcoming" || record.status === "planned"
    );

    if (node.tone === "past") {
        return (
            <>
                {hasUpcoming ? (
                    <circle
                        cx={x}
                        cy={y}
                        fill="none"
                        r={radius + 3}
                        stroke={ROUTE_STYLES.upcoming.color}
                        strokeWidth={1.5}
                    />
                ) : null}
                <circle
                    cx={x}
                    cy={y}
                    fill={ROUTE_STYLES.completed.color}
                    r={radius}
                    stroke="var(--map-halo)"
                    strokeWidth={1.5}
                />
            </>
        );
    }

    const style = node.tone === "future" ? ROUTE_STYLES.upcoming : ROUTE_STYLES.cancelled;
    return (
        <circle
            cx={x}
            cy={y}
            fill="var(--map-halo)"
            r={radius}
            stroke={style.color}
            strokeDasharray={node.tone === "cancelled" ? "1.5 1.5" : undefined}
            strokeWidth={2}
        />
    );
}

interface RoutePath {
    path: string;
    segment: RouteSegment;
    strokeWidth: number;
}

interface PlacedNode {
    node: MapNode;
    point: Point;
}

function RoutePaths({ paths, isFocused }: { isFocused: boolean; paths: readonly RoutePath[] }) {
    return paths.map(({ path, segment, strokeWidth }) => {
        const style = ROUTE_STYLES[segment.status];
        const width = strokeWidth + (isFocused ? FOCUSED_EXTRA_WIDTH : 0);
        return (
            <g key={segment.key}>
                <path
                    d={path}
                    fill="none"
                    stroke="var(--map-halo)"
                    strokeLinecap="round"
                    strokeOpacity={0.6}
                    strokeWidth={width + 2.5}
                />
                <path
                    d={path}
                    fill="none"
                    stroke={style.color}
                    strokeDasharray={style.dashArray}
                    strokeLinecap="round"
                    strokeOpacity={style.opacity}
                    strokeWidth={width}
                />
            </g>
        );
    });
}

// Every route and endpoint of the scene, memoised apart from the hover focus: pointing at a card
// or a trip in the panel never redraws hundreds of routes. The focus only dims these layers as a
// whole and redraws its own few routes and endpoints on top.

const RouteLinesLayer = memo(function RouteLines({
    mask,
    paths,
}: {
    mask: string | undefined;
    paths: readonly RoutePath[];
}) {
    return (
        <g aria-hidden className="pointer-events-none" mask={mask}>
            <RoutePaths isFocused={false} paths={paths} />
        </g>
    );
});

const RouteNodesLayer = memo(function RouteNodes({ nodes }: { nodes: readonly PlacedNode[] }) {
    return nodes.map(({ node, point }) => (
        <g className="cursor-pointer" data-node={node.key} key={node.key}>
            <circle cx={point[0]} cy={point[1]} fill="transparent" r={12} />
            <NodeMarker node={node} point={point} />
        </g>
    ));
});

/**
 * Routes, endpoints and city labels drawn in screen space, so line widths and text stay
 * constant at every zoom level.
 */
export const MapRoutesLayer = memo(function RoutesLayer({
    scene,
    labelObstacles,
    selectedPath,
    transform,
    focus,
    width,
    height,
}: MapRoutesLayerProps) {
    const maskId = useId();
    const format = useExplorerFormat();
    const toScreen = useCallback(
        (place: Place): Point | null => {
            const projected = projectCoordinates(place.coordinates);
            return projected ? (transform.apply([projected[0], projected[1]]) as Point) : null;
        },
        [transform]
    );

    const paths = useMemo(
        () =>
            scene.segments.flatMap((segment): RoutePath[] => {
                const from = toScreen(segment.from);
                const to = toScreen(segment.to);
                const path = from && to ? buildArcPath(from, to, LIFT_BY_TONE[segment.tone]) : null;
                if (!path) {
                    return [];
                }
                const strokeWidth =
                    ROUTE_STYLES[segment.status].width +
                    Math.min(segment.records.length - 1, 4) * 0.35;
                return [{ path, segment, strokeWidth }];
            }),
        [scene.segments, toScreen]
    );

    const placedNodes = useMemo(
        () =>
            scene.nodes.flatMap((node): PlacedNode[] => {
                const point = toScreen(node.place);
                const isInView =
                    point !== null &&
                    point[0] > -VIEWPORT_MARGIN &&
                    point[0] < width + VIEWPORT_MARGIN &&
                    point[1] > -VIEWPORT_MARGIN &&
                    point[1] < height + VIEWPORT_MARGIN;
                return point && isInView ? [{ node, point }] : [];
            }),
        [height, scene.nodes, toScreen, width]
    );

    const hasFocus = Boolean(focus.recordId || focus.officialId);
    const anchors = scene.mode === "inbound" ? scene.anchors : [];
    const focusedPaths = hasFocus
        ? paths.filter(({ segment }) => matchesFocus(segment.records, focus))
        : [];
    const focusedNodes = hasFocus
        ? placedNodes.filter(({ node }) => matchesFocus(node.records, focus))
        : [];

    const placedLabels: LabelBox[] = [...labelObstacles];
    const labels: { key: string; text: string; x: number; y: number }[] = [];
    const labelCandidates = placedNodes
        .filter(({ node }) => scene.showLabels || matchesFocus(node.records, focus))
        .slice(0, MAP_CONFIG.maxCityLabels);

    for (const { node, point } of labelCandidates) {
        const radius = nodeRadius(node);
        const labelText = format.placeName(node.place);
        const labelWidth = labelText.length * LABEL_CHAR_WIDTH + 4;
        const options: LabelBox[] = [
            {
                height: LABEL_HEIGHT,
                width: labelWidth,
                x: point[0] + radius + LABEL_GAP,
                y: point[1] - LABEL_HEIGHT / 2,
            },
            {
                height: LABEL_HEIGHT,
                width: labelWidth,
                x: point[0] - radius - LABEL_GAP - labelWidth,
                y: point[1] - LABEL_HEIGHT / 2,
            },
            {
                height: LABEL_HEIGHT,
                width: labelWidth,
                x: point[0] - labelWidth / 2,
                y: point[1] - radius - LABEL_GAP - LABEL_HEIGHT,
            },
        ];
        const box = options.find((option) =>
            placedLabels.every((placed) => !overlaps(option, placed))
        );
        if (box) {
            placedLabels.push(box);
            labels.push({ key: node.key, text: labelText, x: box.x + 2, y: box.y + 11 });
        }
    }

    const routeMask = selectedPath ? `url(#${maskId})` : undefined;

    return (
        <g>
            {selectedPath ? (
                <defs>
                    <mask
                        height={height}
                        id={maskId}
                        maskUnits="userSpaceOnUse"
                        width={width}
                        x={0}
                        y={0}
                    >
                        <rect fill="white" height={height} width={width} x={0} y={0} />
                        <path
                            d={selectedPath}
                            fill={`rgb(${SELECTED_ROUTE_VISIBILITY} ${SELECTED_ROUTE_VISIBILITY} ${SELECTED_ROUTE_VISIBILITY})`}
                            transform={transform.toString()}
                        />
                    </mask>
                </defs>
            ) : null}

            <g opacity={hasFocus ? DIMMED_ROUTE_OPACITY : 1}>
                <RouteLinesLayer mask={routeMask} paths={paths} />
            </g>

            <g aria-hidden className="pointer-events-none">
                {anchors.map((place) => {
                    const point = toScreen(place);
                    return point ? (
                        <circle
                            cx={point[0]}
                            cy={point[1]}
                            fill="var(--map-ink)"
                            key={`${place.countryCode}:${place.city}`}
                            r={4}
                            stroke="var(--map-halo)"
                            strokeWidth={2}
                        />
                    ) : null;
                })}
            </g>

            <g opacity={hasFocus ? DIMMED_NODE_OPACITY : 1}>
                <RouteNodesLayer nodes={placedNodes} />
            </g>

            {hasFocus ? (
                <g aria-hidden className="pointer-events-none">
                    <g mask={routeMask}>
                        <RoutePaths isFocused paths={focusedPaths} />
                    </g>
                    {focusedNodes.map(({ node, point }) => (
                        <NodeMarker key={node.key} node={node} point={point} />
                    ))}
                </g>
            ) : null}

            <g aria-hidden className="pointer-events-none">
                {labels.map((label) => (
                    <text
                        className="fill-(--map-ink) font-medium text-[11px]"
                        key={label.key}
                        paintOrder="stroke"
                        stroke="var(--map-halo)"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        x={label.x}
                        y={label.y}
                    >
                        {label.text}
                    </text>
                ))}
            </g>
        </g>
    );
});

"use client";

import type { ZoomTransform } from "d3-zoom";
import { memo } from "react";

import { MAP_CONFIG } from "@/features/travel-explorer/constants/explorer.constants";
import {
    DIMMED_ROUTE_OPACITY,
    ROUTE_STYLES,
} from "@/features/travel-explorer/constants/map-style.constants";
import type { Place, TravelRecord } from "@/features/travel-explorer/types/travel.types";
import {
    buildArcPath,
    type Point,
    projectCoordinates,
} from "@/features/travel-explorer/utils/map-geometry.utils";
import type {
    MapNode,
    MapScene,
    RouteTone,
} from "@/features/travel-explorer/utils/map-scene.utils";

interface RouteFocus {
    /** Official whose routes to emphasise (hovered card). */
    officialId: string | null;
    /** Trip to emphasise (selected or hovered). */
    recordId: string | null;
}

interface MapRoutesLayerProps {
    /** Selected country's pointer, in map units; labels keep clear of its callout. */
    calloutAnchor: Point | null;
    focus: RouteFocus;
    height: number;
    scene: MapScene;
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
/** Approximate footprint of the country callout drawn above its anchor. */
const CALLOUT_HALF_WIDTH = 100;
const CALLOUT_HEIGHT = 58;

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

/**
 * Routes, endpoints and city labels drawn in screen space, so line widths and text stay
 * constant at every zoom level.
 */
export const MapRoutesLayer = memo(function RoutesLayer({
    scene,
    calloutAnchor,
    transform,
    focus,
    width,
    height,
}: MapRoutesLayerProps) {
    const toScreen = (place: Place): Point | null => {
        const projected = projectCoordinates(place.coordinates);
        return projected ? (transform.apply([projected[0], projected[1]]) as Point) : null;
    };
    const isInView = ([x, y]: Point) =>
        x > -VIEWPORT_MARGIN &&
        x < width + VIEWPORT_MARGIN &&
        y > -VIEWPORT_MARGIN &&
        y < height + VIEWPORT_MARGIN;

    const hasFocus = Boolean(focus.recordId || focus.officialId);
    const anchors = scene.mode === "inbound" ? scene.anchors : [];

    const placedLabels: LabelBox[] = [];
    if (calloutAnchor) {
        const [anchorX, anchorY] = transform.apply([calloutAnchor[0], calloutAnchor[1]]);
        placedLabels.push({
            height: CALLOUT_HEIGHT,
            width: CALLOUT_HALF_WIDTH * 2,
            x: anchorX - CALLOUT_HALF_WIDTH,
            y: anchorY - CALLOUT_HEIGHT,
        });
    }
    const labels: { key: string; text: string; x: number; y: number }[] = [];
    const labelCandidates = scene.nodes
        .filter((node) => scene.showLabels || matchesFocus(node.records, focus))
        .slice(0, MAP_CONFIG.maxCityLabels);

    for (const node of labelCandidates) {
        const point = toScreen(node.place);
        if (!(point && isInView(point))) {
            continue;
        }
        const radius = nodeRadius(node);
        const labelWidth = node.place.city.length * LABEL_CHAR_WIDTH + 4;
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
            labels.push({ key: node.key, text: node.place.city, x: box.x + 2, y: box.y + 11 });
        }
    }

    return (
        <g>
            <g aria-hidden className="pointer-events-none">
                {scene.segments.map((segment) => {
                    const from = toScreen(segment.from);
                    const to = toScreen(segment.to);
                    const path =
                        from && to ? buildArcPath(from, to, LIFT_BY_TONE[segment.tone]) : null;
                    if (!path) {
                        return null;
                    }

                    const style = ROUTE_STYLES[segment.status];
                    const isEmphasised = !hasFocus || matchesFocus(segment.records, focus);
                    const strokeWidth =
                        style.width +
                        Math.min(segment.records.length - 1, 4) * 0.35 +
                        (hasFocus && isEmphasised ? 0.75 : 0);

                    return (
                        <g
                            className="fade-in animate-in transition-opacity duration-300 motion-reduce:animate-none"
                            key={segment.key}
                            opacity={isEmphasised ? 1 : DIMMED_ROUTE_OPACITY}
                        >
                            <path
                                d={path}
                                fill="none"
                                stroke="var(--map-halo)"
                                strokeLinecap="round"
                                strokeOpacity={0.6}
                                strokeWidth={strokeWidth + 2.5}
                            />
                            <path
                                d={path}
                                fill="none"
                                stroke={style.color}
                                strokeDasharray={style.dashArray}
                                strokeLinecap="round"
                                strokeOpacity={style.opacity}
                                strokeWidth={strokeWidth}
                            />
                        </g>
                    );
                })}

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

            {scene.nodes.map((node) => {
                const point = toScreen(node.place);
                if (!(point && isInView(point))) {
                    return null;
                }
                const isEmphasised = !hasFocus || matchesFocus(node.records, focus);
                return (
                    <g
                        className="cursor-pointer transition-opacity duration-300"
                        data-node={node.key}
                        key={node.key}
                        opacity={isEmphasised ? 1 : DIMMED_ROUTE_OPACITY + 0.15}
                    >
                        <circle cx={point[0]} cy={point[1]} fill="transparent" r={12} />
                        <NodeMarker node={node} point={point} />
                    </g>
                );
            })}

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

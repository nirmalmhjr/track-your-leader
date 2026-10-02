"use client";

import { useTranslations } from "next-intl";
import {
    type KeyboardEvent,
    type MouseEvent,
    type PointerEvent,
    useCallback,
    useEffect,
    useEffectEvent,
    useId,
    useMemo,
    useRef,
    useState,
} from "react";

import { MapCountriesLayer } from "@/features/travel-explorer/components/map/map-countries-layer";
import { MapCountryCallout } from "@/features/travel-explorer/components/map/map-country-callout";
import { MapFlagFill } from "@/features/travel-explorer/components/map/map-flag-fill";
import {
    type MapHoverTarget,
    MapHoverTooltip,
} from "@/features/travel-explorer/components/map/map-hover-tooltip";
import { MapLegend } from "@/features/travel-explorer/components/map/map-legend";
import { MapRoutesLayer } from "@/features/travel-explorer/components/map/map-routes-layer";
import { MapScopeSummary } from "@/features/travel-explorer/components/map/map-scope-summary";
import { MapZoomControls } from "@/features/travel-explorer/components/map/map-zoom-controls";
import { MAP_CONFIG } from "@/features/travel-explorer/constants/explorer.constants";
import {
    COUNTRY_FILLS,
    SEQUENTIAL_FILLS,
} from "@/features/travel-explorer/constants/map-style.constants";
import { useExplorerData } from "@/features/travel-explorer/hooks/use-explorer-data";
import { useExplorerState } from "@/features/travel-explorer/hooks/use-explorer-state";
import { type MapInsets, useMapZoom } from "@/features/travel-explorer/hooks/use-map-zoom";
import type { ExplorerSelection } from "@/features/travel-explorer/types/explorer.types";
import type { TravelRecord } from "@/features/travel-explorer/types/travel.types";
import {
    type Bounds,
    combineBounds,
    computeCalloutLayout,
    GRATICULE_PATH,
    getCountryAnchor,
    type MapCountryShape,
    type Point,
    projectCoordinates,
    type ScreenBox,
    SPHERE_PATH,
} from "@/features/travel-explorer/utils/map-geometry.utils";
import {
    buildMapScene,
    type MapNode,
    type MapScene,
} from "@/features/travel-explorer/utils/map-scene.utils";
import { useExplorerUiStore } from "@/stores/explorer-ui-store";

interface WorldMapCanvasProps {
    height: number;
    insets: MapInsets;
    /** Where overlays sit relative to panels covering the map. */
    overlayOffsets: { left: number; bottom: number };
    shapes: readonly MapCountryShape[];
    width: number;
}

/** Closest zoom used when framing a whole country, leaving regional context visible. */
const COUNTRY_FRAME_ZOOM = 6.5;
/** A selected country smaller than this share of the viewport keeps city labels off its flag. */
const FLAG_LABEL_GUARD_MAX_SHARE = 0.2;
const ROUTE_FRAME_ZOOM = 6;

const computeFills = (
    shapes: readonly MapCountryShape[],
    scene: MapScene,
    trackedCodes: ReadonlySet<string>
): Map<string, string> => {
    const fills = new Map<string, string>();

    for (const shape of shapes) {
        const code = shape.reference?.alpha3;
        let fill: string = COUNTRY_FILLS.land;

        if (code === scene.focusCountry) {
            fill = COUNTRY_FILLS.selected;
        } else if (code) {
            const step = scene.scale.stepFor(scene.values.get(code) ?? 0);
            if (step >= 0) {
                fill = SEQUENTIAL_FILLS[step];
            } else if (scene.mode === "world" && trackedCodes.has(code)) {
                fill = COUNTRY_FILLS.tracked;
            }
        }

        fills.set(shape.key, fill);
    }

    return fills;
};

const projectPlaces = (coordinates: readonly (readonly [number, number])[]): Point[] =>
    coordinates.flatMap((pair) => {
        const point = projectCoordinates(pair);
        return point ? [point] : [];
    });

interface FrameInput {
    countryBounds: Bounds | null;
    scene: MapScene;
    selection: ExplorerSelection;
    trip: TravelRecord | undefined;
}

/** Works out what to frame for the current selection: a route, an itinerary or a country. */
const getSelectionFrame = ({
    selection,
    scene,
    trip,
    countryBounds,
}: FrameInput): { bounds: Bounds; maxZoom: number } | null => {
    if (!selection.country) {
        return null;
    }

    if (trip) {
        const bounds = combineBounds(
            projectPlaces([trip.origin.coordinates, trip.destination.coordinates])
        );
        return bounds ? { bounds, maxZoom: ROUTE_FRAME_ZOOM } : null;
    }

    const extraBounds = countryBounds ? [countryBounds] : [];
    if (selection.official) {
        const bounds = combineBounds(
            projectPlaces([
                ...scene.nodes.map((node) => node.place.coordinates),
                ...scene.anchors.map((place) => place.coordinates),
            ]),
            extraBounds
        );
        return bounds ? { bounds, maxZoom: ROUTE_FRAME_ZOOM } : null;
    }

    const bounds = combineBounds([], extraBounds);
    return bounds ? { bounds, maxZoom: COUNTRY_FRAME_ZOOM } : null;
};

/** The interactive SVG map with its screen-space overlays. */
export function WorldMapCanvas({
    shapes,
    width,
    height,
    insets,
    overlayOffsets,
}: WorldMapCanvasProps) {
    const t = useTranslations("Explorer.map");
    const titleId = useId();
    const instructionsId = useId();
    const svgRef = useRef<SVGSVGElement>(null);
    const data = useExplorerData();
    const { selection, level, selectCountry, selectTrip, goUp } = useExplorerState();
    const hoveredCountry = useExplorerUiStore((state) => state.hoveredCountry);
    const hoveredOfficialId = useExplorerUiStore((state) => state.hoveredOfficialId);
    const hoveredRecordId = useExplorerUiStore((state) => state.hoveredRecordId);
    const [hover, setHover] = useState<MapHoverTarget | null>(null);

    const { transform, zoomBy, panBy, resetView, fitBounds, getCameraMode } = useMapZoom({
        height,
        insets,
        svgRef,
        width,
    });

    const shapeByKey = useMemo(() => new Map(shapes.map((shape) => [shape.key, shape])), [shapes]);
    const shapeByCode = useMemo(
        () =>
            new Map(
                shapes.flatMap((shape) =>
                    shape.reference ? [[shape.reference.alpha3, shape] as const] : []
                )
            ),
        [shapes]
    );
    const trackedCodes = useMemo(() => new Set(data.countryByCode.keys()), [data.countryByCode]);

    const scene = useMemo(
        () =>
            buildMapScene({
                countryByCode: data.countryByCode,
                matchingRecords: data.matchingRecords,
                recordsByDestination: data.recordsByDestination,
                recordsByOfficial: data.recordsByOfficial,
                recordsByOrigin: data.recordsByOrigin,
                selection,
            }),
        [data, selection]
    );
    const fills = useMemo(
        () => computeFills(shapes, scene, trackedCodes),
        [shapes, scene, trackedCodes]
    );
    const focus = useMemo(
        () => ({
            officialId: selection.official ? null : hoveredOfficialId,
            recordId: hoveredRecordId ?? selection.trip,
        }),
        [hoveredOfficialId, hoveredRecordId, selection.official, selection.trip]
    );

    const selectedShape = selection.country ? shapeByCode.get(selection.country) : undefined;
    const highlightedShape = hoveredCountry ? shapeByCode.get(hoveredCountry) : undefined;
    // The flag previews whichever country is pointed at, on the map or in the panel list.
    const previewShape =
        (hover?.kind === "country" && hover.shape.reference ? hover.shape : undefined) ??
        highlightedShape;
    const calloutLayout = useMemo(() => {
        if (!selectedShape) {
            return null;
        }
        const anchor = getCountryAnchor(
            selectedShape,
            data.countryByCode.get(selection.country ?? "")?.capital.coordinates ?? null
        );
        const [[, bodyTop], [, bodyBottom]] = selectedShape.bounds;
        return computeCalloutLayout(
            transform.apply([anchor[0], anchor[1]]),
            { bottom: transform.applyY(bodyBottom), top: transform.applyY(bodyTop) },
            { bottom: height - insets.bottom, top: insets.top }
        );
    }, [
        data.countryByCode,
        height,
        insets.bottom,
        insets.top,
        selectedShape,
        selection.country,
        transform,
    ]);

    const labelObstacles = useMemo(() => {
        const obstacles: ScreenBox[] = calloutLayout ? [calloutLayout.box] : [];
        if (selectedShape) {
            const [[x0, y0], [x1, y1]] = selectedShape.bounds;
            const [left, top] = transform.apply([x0, y0]);
            const [right, bottom] = transform.apply([x1, y1]);
            const box = { height: bottom - top, width: right - left, x: left, y: top };
            if (box.width * box.height < width * height * FLAG_LABEL_GUARD_MAX_SHARE) {
                obstacles.push(box);
            }
        }
        return obstacles;
    }, [calloutLayout, height, selectedShape, transform, width]);

    const frameSelection = useCallback(() => {
        const frame = getSelectionFrame({
            countryBounds: selectedShape?.bounds ?? null,
            scene,
            selection,
            trip: selection.trip ? data.recordById.get(selection.trip) : undefined,
        });
        if (frame) {
            fitBounds(frame.bounds, frame.maxZoom);
        } else {
            resetView();
        }
    }, [data.recordById, fitBounds, resetView, scene, selectedShape, selection]);

    const frameKey = `${selection.country}|${selection.official}|${selection.trip}`;
    const onFrameKeyChange = useEffectEvent((_key: string) => frameSelection());
    useEffect(() => {
        onFrameKeyChange(frameKey);
    }, [frameKey]);

    // When panels change the visible area, keep a framed selection framed.
    const viewportKey = `${width}|${height}|${insets.left}|${insets.bottom}`;
    const onViewportChange = useEffectEvent((_key: string) => {
        if (getCameraMode() === "framed") {
            frameSelection();
        }
    });
    useEffect(() => {
        onViewportChange(viewportKey);
    }, [viewportKey]);

    const findNode = useCallback(
        (target: Element): MapNode | undefined => {
            const nodeKey = target.closest("[data-node]")?.getAttribute("data-node");
            return nodeKey ? scene.nodes.find((candidate) => candidate.key === nodeKey) : undefined;
        },
        [scene.nodes]
    );

    const findShape = useCallback(
        (target: Element): MapCountryShape | undefined => {
            const countryKey = target.closest("[data-country]")?.getAttribute("data-country");
            return countryKey ? shapeByKey.get(countryKey) : undefined;
        },
        [shapeByKey]
    );

    const handlePointerMove = useCallback(
        (event: PointerEvent<HTMLElement>) => {
            if (
                !(event.target instanceof Element) ||
                event.pointerType !== "mouse" ||
                event.buttons !== 0
            ) {
                setHover(null);
                return;
            }

            const rect = event.currentTarget.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            const node = findNode(event.target);
            if (node) {
                setHover({ kind: "node", node, x, y });
                return;
            }

            const shape = findShape(event.target);
            setHover(shape ? { kind: "country", shape, x, y } : null);
        },
        [findNode, findShape]
    );

    const clearHover = useCallback(() => setHover(null), []);

    const handleClick = useCallback(
        (event: MouseEvent<HTMLElement>) => {
            if (!(event.target instanceof Element)) {
                return;
            }

            const node = findNode(event.target);
            if (node) {
                selectTrip(node.latest);
                return;
            }

            const code = findShape(event.target)?.reference?.alpha3;
            if (!code || (code === selection.country && level === "country")) {
                return;
            }
            selectCountry(code, data.countryByCode.has(code) ? "officials" : "inbound");
        },
        [
            data.countryByCode,
            findNode,
            findShape,
            level,
            selectCountry,
            selectTrip,
            selection.country,
        ]
    );

    const zoomIn = useCallback(() => zoomBy(MAP_CONFIG.zoomStep), [zoomBy]);
    const zoomOut = useCallback(() => zoomBy(1 / MAP_CONFIG.zoomStep), [zoomBy]);

    const handleKeyDown = useCallback(
        (event: KeyboardEvent<HTMLElement>) => {
            if (event.metaKey || event.ctrlKey || event.altKey) {
                return;
            }

            const actions: Record<string, () => void> = {
                "-": zoomOut,
                "+": zoomIn,
                "=": zoomIn,
                "0": resetView,
                ArrowDown: () => panBy(0, -MAP_CONFIG.panStepPx),
                ArrowLeft: () => panBy(MAP_CONFIG.panStepPx, 0),
                ArrowRight: () => panBy(-MAP_CONFIG.panStepPx, 0),
                ArrowUp: () => panBy(0, MAP_CONFIG.panStepPx),
                Escape: goUp,
                f: frameSelection,
            };
            const action = actions[event.key];
            if (action && !(event.key === "Escape" && level === "world")) {
                event.preventDefault();
                action();
            }
        },
        [frameSelection, goUp, level, panBy, resetView, zoomIn, zoomOut]
    );

    return (
        // biome-ignore lint/a11y/noNoninteractiveElementInteractions: Pointer and keyboard shortcuts drive the map; every selection is also reachable from the panel and search.
        <section
            aria-describedby={instructionsId}
            aria-label={t("label")}
            className="absolute inset-0 outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset"
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            onPointerLeave={clearHover}
            onPointerMove={handlePointerMove}
            // biome-ignore lint/a11y/noNoninteractiveTabindex: The map viewport is focusable so keyboard users can pan and zoom it.
            tabIndex={0}
        >
            <p className="sr-only" id={instructionsId}>
                {t("instructions")}
            </p>
            <svg
                aria-labelledby={titleId}
                className="block size-full touch-none select-none"
                height={height}
                ref={svgRef}
                role="img"
                width={width}
            >
                <title id={titleId}>{t("title")}</title>
                <g transform={transform.toString()}>
                    <path
                        className="fill-(--map-ocean) stroke-border [stroke-width:0.75] [vector-effect:non-scaling-stroke]"
                        d={SPHERE_PATH}
                    />
                    <path
                        aria-hidden
                        className="pointer-events-none fill-none stroke-(--map-graticule) [stroke-width:0.5] [vector-effect:non-scaling-stroke]"
                        d={GRATICULE_PATH}
                    />
                    <MapCountriesLayer
                        fills={fills}
                        highlightedKey={highlightedShape?.key ?? null}
                        selectedKey={selectedShape?.key ?? null}
                        shapes={shapes}
                    />
                    {selectedShape ? (
                        <MapFlagFill
                            key={selectedShape.key}
                            shape={selectedShape}
                            variant="selected"
                        />
                    ) : null}
                    {previewShape && previewShape.key !== selectedShape?.key ? (
                        <MapFlagFill
                            key={previewShape.key}
                            shape={previewShape}
                            variant="preview"
                        />
                    ) : null}
                </g>
                <MapRoutesLayer
                    focus={focus}
                    height={height}
                    labelObstacles={labelObstacles}
                    scene={scene}
                    selectedPath={selectedShape?.path ?? null}
                    transform={transform}
                    width={width}
                />
            </svg>

            {selectedShape && calloutLayout ? (
                <MapCountryCallout
                    height={height}
                    layout={calloutLayout}
                    shape={selectedShape}
                    width={width}
                />
            ) : null}
            {hover ? (
                <MapHoverTooltip height={height} scene={scene} target={hover} width={width} />
            ) : null}

            <MapScopeSummary left={overlayOffsets.left} scene={scene} />
            <MapLegend bottom={overlayOffsets.bottom} left={overlayOffsets.left} scene={scene} />
            <MapZoomControls
                bottom={overlayOffsets.bottom}
                onFrameSelection={selection.country ? frameSelection : null}
                onReset={resetView}
                onZoomIn={zoomIn}
                onZoomOut={zoomOut}
            />
        </section>
    );
}

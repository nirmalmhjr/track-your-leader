import { geoArea, geoEqualEarth, geoGraticule10, geoPath } from "d3-geo";
import type { Feature, Geometry, MultiPolygon, Polygon } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";

import { MAP_CONFIG } from "@/features/travel-explorer/constants/explorer.constants";
import { type CountryReference, resolveFeatureReference } from "@/lib/geo/country-reference";
import type { Coordinates } from "@/types/geo.types";

export type Point = readonly [x: number, y: number];
export type Bounds = readonly [topLeft: Point, bottomRight: Point];

export type WorldTopology = Topology<{
    countries: GeometryCollection<{ name: string }>;
}>;

export interface MapCountryShape {
    /** Bounds of the largest landmass, used for framing so overseas territories don't dominate. */
    bounds: Bounds;
    /** Visual centre of the largest landmass, in map units. */
    centroid: Point;
    /** Stable key: ISO numeric id, or the feature name for uncoded territories. */
    key: string;
    name: string;
    path: string;
    reference: CountryReference | null;
}

const SPHERE = { type: "Sphere" } as const;
const PATH_PRECISION = 2;

/**
 * Equal Earth is an equal-area projection, so every country keeps its true relative size,
 * which matters when the map is used to compare where officials travel.
 */
export const WORLD_PROJECTION = geoEqualEarth().fitWidth(MAP_CONFIG.worldWidth, SPHERE);

const worldPath = geoPath(WORLD_PROJECTION).digits(PATH_PRECISION);

const [, [, worldBottom]] = worldPath.bounds(SPHERE);

export const MAP_WORLD_HEIGHT = worldBottom;
export const SPHERE_PATH = worldPath(SPHERE) ?? "";
export const GRATICULE_PATH = worldPath(geoGraticule10()) ?? "";

/**
 * Projects geographic coordinates into map units.
 *
 * @param coordinates - Longitude/latitude pair.
 * @returns The projected point, or `null` when the point cannot be projected.
 */
export const projectCoordinates = (coordinates: Coordinates): Point | null =>
    WORLD_PROJECTION([coordinates[0], coordinates[1]]) ?? null;

const isAreaGeometry = (geometry: Geometry): geometry is Polygon | MultiPolygon =>
    geometry.type === "Polygon" || geometry.type === "MultiPolygon";

const largestPolygon = (geometry: Polygon | MultiPolygon): Polygon => {
    if (geometry.type === "Polygon") {
        return geometry;
    }

    let best: Polygon = { coordinates: geometry.coordinates[0], type: "Polygon" };
    let bestArea = 0;

    for (const coordinates of geometry.coordinates) {
        const polygon: Polygon = { coordinates, type: "Polygon" };
        const area = geoArea(polygon);
        if (area > bestArea) {
            best = polygon;
            bestArea = area;
        }
    }

    return best;
};

/**
 * Converts the world topology into renderable country shapes with framing metadata.
 *
 * @param topology - World countries topology.
 * @returns One shape per country or territory that has geometry.
 */
export const buildCountryShapes = (topology: WorldTopology): MapCountryShape[] => {
    const collection = feature(topology, topology.objects.countries);
    const shapes = new Map<string, { shape: MapCountryShape; area: number }>();

    for (const country of collection.features as Feature<
        Geometry | null,
        { name: string } | null
    >[]) {
        const { geometry } = country;
        if (!(geometry && isAreaGeometry(geometry))) {
            continue;
        }

        const name = country.properties?.name ?? "";
        const numericId = country.id === undefined ? undefined : String(country.id);
        const mainland = largestPolygon(geometry);
        const [[x0, y0], [x1, y1]] = worldPath.bounds(mainland);
        const [cx, cy] = worldPath.centroid(mainland);
        const key = numericId ?? `name:${name}`;
        const candidate = {
            area: geoArea(mainland),
            shape: {
                bounds: [
                    [x0, y0],
                    [x1, y1],
                ] as const,
                centroid: [cx, cy] as const,
                key,
                name,
                path: worldPath(geometry) ?? "",
                reference: resolveFeatureReference(numericId, name) ?? null,
            },
        };

        // Some territories share their sovereign's ISO code (e.g. Ashmore and Cartier Islands
        // and Australia); merge them into one shape framed by the larger landmass.
        const existing = shapes.get(key);
        if (!existing) {
            shapes.set(key, candidate);
            continue;
        }
        const [primary, secondary] =
            candidate.area > existing.area ? [candidate, existing] : [existing, candidate];
        shapes.set(key, {
            area: primary.area,
            shape: { ...primary.shape, path: `${primary.shape.path}${secondary.shape.path}` },
        });
    }

    return [...shapes.values()].map((entry) => entry.shape);
};

/**
 * Where a country's map pointer sits: its capital when known, otherwise the centre of its
 * largest landmass.
 *
 * @param shape - Country shape.
 * @param capital - Capital coordinates for tracked countries.
 * @returns Anchor point in map units.
 */
export const getCountryAnchor = (shape: MapCountryShape, capital: Coordinates | null): Point =>
    (capital ? projectCoordinates(capital) : null) ?? shape.centroid;

/**
 * Computes the smallest box containing every point and box.
 *
 * @param points - Points to include.
 * @param boxes - Bounds to include.
 * @returns Combined bounds, or `null` when nothing was provided.
 */
export const combineBounds = (
    points: readonly Point[],
    boxes: readonly Bounds[] = []
): Bounds | null => {
    const corners = [...points, ...boxes.flat()];
    if (corners.length === 0) {
        return null;
    }

    const xs = corners.map(([x]) => x);
    const ys = corners.map(([, y]) => y);
    return [
        [Math.min(...xs), Math.min(...ys)],
        [Math.max(...xs), Math.max(...ys)],
    ];
};

/**
 * Builds a gently curved route between two screen points. Every arc bows toward the top of
 * the map so overlapping routes read as a consistent family rather than a tangle.
 *
 * @param from - Start point in screen pixels.
 * @param to - End point in screen pixels.
 * @param liftFactor - Multiplier for the curve height, used to separate parallel routes.
 * @returns SVG path data for a quadratic curve, or `null` for points that nearly coincide.
 */
export const buildArcPath = (from: Point, to: Point, liftFactor = 1): string | null => {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const distance = Math.hypot(dx, dy);

    if (distance < MAP_CONFIG.minArcLengthPx) {
        return null;
    }

    const lift = Math.min(distance * 0.22, 140) * liftFactor;
    let normalX = -dy / distance;
    let normalY = dx / distance;
    if (normalY > 0) {
        normalX = -normalX;
        normalY = -normalY;
    }

    const controlX = (from[0] + to[0]) / 2 + normalX * lift;
    const controlY = (from[1] + to[1]) / 2 + normalY * lift;
    const round = (value: number) => value.toFixed(1);

    return `M${round(from[0])},${round(from[1])} Q${round(controlX)},${round(controlY)} ${round(to[0])},${round(to[1])}`;
};

let topologyRequest: Promise<WorldTopology> | null = null;

/**
 * Loads the bundled world topology once and caches the request for every map instance.
 * A failed request is discarded so a retry can load it again.
 *
 * @returns Promise resolving to the world topology.
 */
export const loadWorldTopology = (): Promise<WorldTopology> => {
    topologyRequest ??= import("@/assets/geo/world-countries.topo.json")
        .then((module) => module.default as unknown as WorldTopology)
        .catch((error: unknown) => {
            topologyRequest = null;
            throw error;
        });

    return topologyRequest;
};

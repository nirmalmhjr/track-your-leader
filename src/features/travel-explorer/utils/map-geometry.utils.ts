import { type GeoStream, geoMercator, geoPath, geoStream } from "d3-geo";
import type { Feature, Geometry, MultiPolygon, Polygon } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";

import {
    MAP_CONFIG,
    WORLD_TOPOLOGY_URL,
} from "@/features/travel-explorer/constants/explorer.constants";
import { type CountryReference, resolveFeatureReference } from "@/lib/geo/country-reference";
import type { Coordinates } from "@/types/geo.types";

export type Point = readonly [x: number, y: number];
export type Bounds = readonly [topLeft: Point, bottomRight: Point];

export type WorldTopology = Topology<{
    countries: GeometryCollection<{ name: string }>;
}>;

export interface MapCountryShape {
    /**
     * Bounds of the country's main body (largest landmass plus comparably sized islands), used
     * for framing and for placing the flag so overseas territories don't dominate.
     */
    bounds: Bounds;
    /** Centre of the largest landmass, in map units. */
    centroid: Point;
    /** Stable key: ISO numeric id, or the feature name for uncoded territories. */
    key: string;
    name: string;
    path: string;
    reference: CountryReference | null;
}

const PATH_PRECISION = 2;

/**
 * Latitudes shown on the flat map: just above the northernmost land (83.6°N) down to the
 * southern ocean islands, leaving out Antarctica, which Mercator would stretch without limit.
 */
const MAP_LATITUDE_EXTENT = { north: 84, south: -60 } as const;

const MERCATOR_SCALE = MAP_CONFIG.worldWidth / (2 * Math.PI);

/** Distance of a latitude above the equator on the Mercator map, in map units. */
const mercatorHeight = (latitude: number): number =>
    MERCATOR_SCALE * Math.log(Math.tan(Math.PI / 4 + (latitude * Math.PI) / 360));

const equatorY = mercatorHeight(MAP_LATITUDE_EXTENT.north);

export const MAP_WORLD_HEIGHT = equatorY - mercatorHeight(MAP_LATITUDE_EXTENT.south);

/**
 * Mercator is conformal, so every country keeps its true shape, which matters most when the map
 * frames a single country. It is cropped to a flat rectangle one full turn of longitude across
 * `MAP_CONFIG.worldWidth` map units, with the north edge at y = 0. Centring on
 * `MAP_CONFIG.centralMeridian` puts the edges in the Bering Strait, so land reaches both sides
 * instead of leaving a band of empty Pacific on one of them.
 */
export const WORLD_PROJECTION = geoMercator()
    .rotate([-MAP_CONFIG.centralMeridian, 0])
    .scale(MERCATOR_SCALE)
    .translate([MAP_CONFIG.worldWidth / 2, equatorY])
    .clipExtent([
        [0, 0],
        [MAP_CONFIG.worldWidth, MAP_WORLD_HEIGHT],
    ]);

const worldPath = geoPath(WORLD_PROJECTION).digits(PATH_PRECISION);

const GRATICULE_STEP_DEGREES = 10;
/** Northernmost and southernmost parallels drawn; Mercator cannot reach the poles. */
const GRATICULE_MAX_LATITUDE = 80;
/**
 * How far the graticule runs past the map on every side, in map sizes. The ocean has no edge,
 * so the grid keeps going wherever the map is panned or zoomed out.
 */
const GRATICULE_OVERHANG = 1;

/**
 * Builds the latitude/longitude grid. On Mercator meridians and parallels are straight lines,
 * so they are drawn directly rather than clipped to the map's rectangle.
 */
const buildGraticulePath = (): string => {
    const width = MAP_CONFIG.worldWidth;
    const left = -width * GRATICULE_OVERHANG;
    const right = width * (1 + GRATICULE_OVERHANG);
    const top = -MAP_WORLD_HEIGHT * GRATICULE_OVERHANG;
    const bottom = MAP_WORLD_HEIGHT * (1 + GRATICULE_OVERHANG);
    const spacing = (width * GRATICULE_STEP_DEGREES) / 360;
    const [greenwichX] = WORLD_PROJECTION([0, 0]) ?? [0, 0];
    const round = (value: number) => value.toFixed(PATH_PRECISION);

    const lines: string[] = [];
    const firstMeridianX = greenwichX - Math.floor((greenwichX - left) / spacing) * spacing;
    for (let x = firstMeridianX; x <= right; x += spacing) {
        lines.push(`M${round(x)},${round(top)}V${round(bottom)}`);
    }
    for (
        let latitude = -GRATICULE_MAX_LATITUDE;
        latitude <= GRATICULE_MAX_LATITUDE;
        latitude += GRATICULE_STEP_DEGREES
    ) {
        const y = equatorY - mercatorHeight(latitude);
        lines.push(`M${round(left)},${round(y)}H${round(right)}`);
    }
    return lines.join("");
};

export const GRATICULE_PATH = buildGraticulePath();

/**
 * Projects geographic coordinates into map units. Latitudes beyond the map's extent are pinned
 * to its edge, since Mercator sends the poles to infinity (Antarctica is stored at -90°).
 *
 * @param coordinates - Longitude/latitude pair.
 * @returns The projected point, or `null` when the point cannot be projected.
 */
export const projectCoordinates = ([longitude, latitude]: Coordinates): Point | null => {
    const clampedLatitude = Math.min(
        Math.max(latitude, MAP_LATITUDE_EXTENT.south),
        MAP_LATITUDE_EXTENT.north
    );
    return WORLD_PROJECTION([longitude, clampedLatitude]) ?? null;
};

const isAreaGeometry = (geometry: Geometry): geometry is Polygon | MultiPolygon =>
    geometry.type === "Polygon" || geometry.type === "MultiPolygon";

type Ring = [number, number][];

/** Islands at least this share of the main landmass count as part of the country's body. */
const SIGNIFICANT_RING_SHARE = 0.3;

/**
 * Projects a geometry and collects its rings in map units. Working after projection means
 * polygons split at the antimeridian (e.g. Russia's far east) become separate rings.
 */
const collectProjectedRings = (geometry: Polygon | MultiPolygon): Ring[] => {
    const rings: Ring[] = [];
    let current: Ring = [];
    const sink: GeoStream = {
        lineEnd: () => {
            if (current.length > 2) {
                rings.push(current);
            }
        },
        lineStart: () => {
            current = [];
        },
        point: (x, y) => {
            current.push([x, y]);
        },
        polygonEnd: () => undefined,
        polygonStart: () => undefined,
        sphere: () => undefined,
    };
    geoStream(geometry, WORLD_PROJECTION.stream(sink));
    return rings;
};

const ringArea = (ring: Ring): number => {
    let doubled = 0;
    for (let index = 0; index < ring.length; index += 1) {
        const [x0, y0] = ring[index];
        const [x1, y1] = ring[(index + 1) % ring.length];
        doubled += x0 * y1 - x1 * y0;
    }
    return Math.abs(doubled) / 2;
};

const ringCentroid = (ring: Ring): Point => {
    const xs = ring.map(([x]) => x);
    const ys = ring.map(([, y]) => y);
    return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
};

const DEGREES_TO_RADIANS = Math.PI / 180;

/**
 * Approximate ground area of a projected ring. Mercator inflates areas by sec²(latitude), so
 * scaling by cos² compares landmasses at their real size and keeps high-latitude parts such as
 * Alaska or Svalbard from outweighing the mainland.
 */
const ringGroundArea = (ring: Ring): number => {
    const [x, y] = ringCentroid(ring);
    const [, latitude] = WORLD_PROJECTION.invert?.([x, y]) ?? [0, 0];
    const cosine = Math.cos(latitude * DEGREES_TO_RADIANS);
    return ringArea(ring) * cosine * cosine;
};

/**
 * Describes the country's main body: its largest landmass plus any island of comparable size,
 * so overseas territories (Alaska, French Guiana) don't stretch the framing or the flag.
 */
const describeMainBody = (
    geometry: Polygon | MultiPolygon
): { area: number; bounds: Bounds; centroid: Point } | null => {
    const rings = collectProjectedRings(geometry).map((ring) => ({
        area: ringGroundArea(ring),
        ring,
    }));
    const largest = rings.reduce<(typeof rings)[number] | null>(
        (best, candidate) => (!best || candidate.area > best.area ? candidate : best),
        null
    );
    if (!largest) {
        return null;
    }

    const body = rings.filter((entry) => entry.area >= largest.area * SIGNIFICANT_RING_SHARE);
    const points = body.flatMap((entry) => entry.ring);
    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);

    return {
        area: largest.area,
        bounds: [
            [Math.min(...xs), Math.min(...ys)],
            [Math.max(...xs), Math.max(...ys)],
        ],
        centroid: ringCentroid(largest.ring),
    };
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
        const body = geometry && isAreaGeometry(geometry) ? describeMainBody(geometry) : null;
        if (!(geometry && body)) {
            continue;
        }

        const name = country.properties?.name ?? "";
        const numericId = country.id === undefined ? undefined : String(country.id);
        const key = numericId ?? `name:${name}`;
        const candidate = {
            area: body.area,
            shape: {
                bounds: body.bounds,
                centroid: body.centroid,
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

export interface ScreenBox {
    height: number;
    width: number;
    x: number;
    y: number;
}

export interface CalloutLayout {
    anchor: Point;
    /** Approximate screen footprint, used to keep labels clear of the callout. */
    box: ScreenBox;
    /** Distance in pixels between the anchor and the callout's nearest edge. */
    offset: number;
    placement: "above" | "below";
}

const CALLOUT_SIZE = { height: 72, width: 236 } as const;
const CALLOUT_GAP = { max: 140, min: 14, outside: 10 } as const;

/**
 * Places the country callout just outside the country's body, above it when there is room and
 * below otherwise, so the callout never hides the flag of a small country. When neither side
 * has room, it is pinned to the top of the free area.
 *
 * @param anchor - Anchor point (capital or centre) in screen pixels.
 * @param body - Screen y of the country's northern and southern edges.
 * @param freeArea - Screen y range not covered by overlays or panels.
 * @returns Placement, leader-line length and the callout's screen footprint.
 */
export const computeCalloutLayout = (
    anchor: Point,
    body: { top: number; bottom: number },
    freeArea: { top: number; bottom: number }
): CalloutLayout => {
    const [x, y] = anchor;
    const clampGap = (gap: number) =>
        Math.min(Math.max(gap + CALLOUT_GAP.outside, CALLOUT_GAP.min), CALLOUT_GAP.max);
    const aboveOffset = clampGap(y - body.top);
    const belowOffset = clampGap(body.bottom - y);
    const fitsAbove = y - aboveOffset - CALLOUT_SIZE.height >= freeArea.top;
    const fitsBelow = y + belowOffset + CALLOUT_SIZE.height <= freeArea.bottom;

    let placement: CalloutLayout["placement"] = "above";
    let offset = aboveOffset;
    if (!fitsAbove && fitsBelow) {
        placement = "below";
        offset = belowOffset;
    } else if (!fitsAbove) {
        offset = Math.max(CALLOUT_GAP.min, y - freeArea.top - CALLOUT_SIZE.height);
    }

    const halfWidth = CALLOUT_SIZE.width / 2;
    return {
        anchor,
        box: {
            height: CALLOUT_SIZE.height,
            width: CALLOUT_SIZE.width,
            x: x - halfWidth,
            y: placement === "above" ? y - offset - CALLOUT_SIZE.height : y + offset,
        },
        offset,
        placement,
    };
};

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

const fetchWorldTopology = async (): Promise<WorldTopology> => {
    const response = await fetch(WORLD_TOPOLOGY_URL);
    if (!response.ok) {
        throw new Error(`World map unavailable (HTTP ${response.status})`);
    }
    return (await response.json()) as WorldTopology;
};

/**
 * Loads the world topology once and caches the request for every map instance. The page
 * preloads the same URL, so this usually picks up a download that is already under way.
 * A failed request is discarded so a retry can load it again.
 *
 * @returns Promise resolving to the world topology.
 */
export const loadWorldTopology = (): Promise<WorldTopology> => {
    topologyRequest ??= fetchWorldTopology().catch((error: unknown) => {
        topologyRequest = null;
        throw error;
    });

    return topologyRequest;
};

import type { Bounds, MapCountryShape } from "@/features/travel-explorer/utils/map-geometry.utils";
import type { CountryReference } from "@/lib/geo/country-reference";

/**
 * Continents drawn in their own colour in dark mode, west to east. Antarctica isn't drawn: the
 * flat map stops at 60°S.
 */
export const MAP_CONTINENTS = [
    "north-america",
    "south-america",
    "africa",
    "europe",
    "asia",
    "oceania",
] as const;
export type MapContinent = (typeof MAP_CONTINENTS)[number];

const CONTINENT_BY_REGION: Readonly<Record<string, MapContinent>> = {
    Africa: "africa",
    Asia: "asia",
    Europe: "europe",
    Oceania: "oceania",
};

/**
 * The continent a country is coloured as, following the region data: the Americas split into
 * South America and the rest (North and Central America and the Caribbean), Russia in Europe.
 *
 * @param reference - The country, if known.
 * @returns The continent, or `null` for unknown places and Antarctica.
 */
export const getMapContinent = (reference: CountryReference | null): MapContinent | null => {
    if (!reference) {
        return null;
    }
    if (reference.region === "Americas") {
        return reference.subregion === "South America" ? "south-america" : "north-america";
    }
    return CONTINENT_BY_REGION[reference.region] ?? null;
};

/** Id of the map's gradient for a continent's land. */
export const continentGradientId = (continent: MapContinent): string => `map-land-${continent}`;

/**
 * Fill for a country: its continent's land where the theme defines one (dark mode paints each
 * continent with its own fade), and plain land otherwise.
 *
 * @param continent - The country's continent, if any.
 * @returns A CSS fill value.
 */
export const continentFill = (continent: MapContinent | null): string =>
    continent ? `var(--map-land-${continent}, var(--map-land))` : "var(--map-land)";

/**
 * Top and bottom of each continent's land, in map units, so its fade runs the continent's height.
 *
 * @param shapes - Every country shape.
 * @returns The vertical extent of each continent drawn.
 */
export const getContinentExtents = (
    shapes: readonly MapCountryShape[]
): Map<MapContinent, { bottom: number; top: number }> => {
    const extents = new Map<MapContinent, { bottom: number; top: number }>();
    for (const shape of shapes) {
        const continent = getMapContinent(shape.reference);
        if (!continent) {
            continue;
        }
        const [[, top], [, bottom]]: Bounds = shape.bounds;
        const extent = extents.get(continent);
        extents.set(
            continent,
            extent
                ? { bottom: Math.max(extent.bottom, bottom), top: Math.min(extent.top, top) }
                : { bottom, top }
        );
    }
    return extents;
};

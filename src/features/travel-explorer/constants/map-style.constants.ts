/** Sequential fills, lightest (fewest trips) first. */
export const SEQUENTIAL_FILLS = [
    "var(--map-seq-1)",
    "var(--map-seq-2)",
    "var(--map-seq-3)",
    "var(--map-seq-4)",
    "var(--map-seq-5)",
] as const;

export const COUNTRY_FILLS = {
    land: "var(--map-land)",
    selected: "var(--map-selected)",
    tracked: "var(--map-land-tracked)",
} as const;

/** Opacity applied to routes that are not part of the hovered or selected subset. */
export const DIMMED_ROUTE_OPACITY = 0.18;

/** Looks the map can be shown in; the first is the default. */
export const MAP_STYLES = ["simple", "terrain"] as const;

/**
 * Terrain imagery behind the "terrain" style, built by `pnpm geo:terrain` from Natural Earth II
 * (public domain) in the map's own projection and cut into square tiles. Each level is twice as
 * wide as the one before.
 */
export const TERRAIN_TILES = {
    /** Width of the whole world at level 0, in pixels. */
    baseWidthPx: 1024,
    maxLevel: 3,
    tileSizePx: 512,
    urlPrefix: "/geo/terrain",
} as const;

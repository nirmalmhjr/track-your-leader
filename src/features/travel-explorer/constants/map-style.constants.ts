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

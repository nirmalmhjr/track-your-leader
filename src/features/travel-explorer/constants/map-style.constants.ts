import type { TravelStatus } from "@/features/travel-explorer/types/travel.types";

interface RouteStyle {
    color: string;
    /** SVG dash pattern; omitted for solid lines. Texture doubles the colour encoding. */
    dashArray?: string;
    opacity: number;
    width: number;
}

export const ROUTE_STYLES: Readonly<Record<TravelStatus, RouteStyle>> = {
    cancelled: { color: "var(--travel-cancelled)", dashArray: "2 4", opacity: 0.7, width: 1.2 },
    completed: { color: "var(--travel-completed)", opacity: 0.9, width: 1.6 },
    planned: { color: "var(--travel-upcoming)", dashArray: "0.5 4", opacity: 0.9, width: 2 },
    upcoming: { color: "var(--travel-upcoming)", dashArray: "6 4", opacity: 0.95, width: 1.6 },
};

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

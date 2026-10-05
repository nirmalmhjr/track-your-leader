import type { WorldRegion } from "@/types/geo.types";

export const DESTINATION_REGIONS = [
    "Africa",
    "Americas",
    "Asia",
    "Europe",
    "Oceania",
] as const satisfies readonly WorldRegion[];

/** Tabs available inside a country: outbound officials, outbound trips, inbound visits. */
export const COUNTRY_VIEWS = ["officials", "travel", "inbound"] as const;

export const OFFICIAL_SORTS = ["rank", "trips", "recent", "name"] as const;

/** Orders of the overview country index; the first is the default. */
export const COUNTRY_SORTS = ["name", "trips"] as const;

/** Ways to look back at a country's former officials; the first is the default. */
export const FORMER_LAYOUTS = ["position", "year", "person"] as const;

/** Number of steps in the sequential map shading scale. */
export const SEQUENTIAL_STEPS = 5;

export const MAP_CONFIG = {
    /**
     * Longitude at the centre of the map. The opposite meridian, 168.97°W, is where the map's
     * left and right edges meet: the Russia–US line in the Bering Strait, so Russia and Fiji stay
     * whole. `pnpm geo:build` joins the land on either side of 180° for this seam, so rerun it
     * after changing the value.
     */
    centralMeridian: 11.03,
    /** Share of the available viewport a framed selection may occupy. */
    fitFill: 0.82,
    /** Closest zoom used when automatically framing a single country. */
    maxAutoFitZoom: 7,
    /** Maximum city labels drawn at once before falling back to tooltips. */
    maxCityLabels: 14,
    /** Maximum zoom relative to the fitted world view. */
    maxZoom: 14,
    /** Minimum on-screen distance (px) for drawing a route arc. */
    minArcLengthPx: 3,
    panStepPx: 80,
    transitionMs: 650,
    /** Width of the projected world in map units; height follows from the projection. */
    worldWidth: 1000,
    zoomStep: 1.6,
} as const;

/**
 * Country outlines for the map, served as a static file (built by `pnpm geo:build`). Kept out of
 * the JavaScript bundle so it needs no compiling, caches on its own and downloads with the page.
 */
export const WORLD_TOPOLOGY_URL = "/geo/world-countries.topo.json";

/**
 * From this width up the panel is a floating drawer on the right of the map; below it, a bottom
 * sheet. Keep in sync with the `md:` and `max-md:` classes on the panel.
 */
export const TABLET_UP_MEDIA_QUERY = "(min-width: 768px)";

/**
 * Floating panel on the right of the map, below the header. Keep in sync with the
 * `md:w-[380px]`, `xl:w-[420px]` and `*-3` classes on the panel.
 */
export const PANEL_WIDTH_PX = 380;
export const PANEL_WIDTH_XL_PX = 420;
export const PANEL_GAP_PX = 12;

/**
 * Heights the phone bottom sheet rests at, from fully open to only its header showing. The
 * last is where it starts.
 */
export const SHEET_SNAPS = ["full", "half", "peek"] as const;

/** Share of the sheet's full height showing at the half snap. */
export const SHEET_HALF_RATIO = 0.5;

/** Release speed (px/ms) above which a drag moves the sheet on to the next snap. */
export const SHEET_FLICK_VELOCITY = 0.4;

/** Element id of the exploration panel, referenced by the toggle that shows and hides it. */
export const EXPLORER_PANEL_ID = "explorer-panel";

/** Number of upcoming trips listed in the global overview. */
export const OVERVIEW_UPCOMING_LIMIT = 6;

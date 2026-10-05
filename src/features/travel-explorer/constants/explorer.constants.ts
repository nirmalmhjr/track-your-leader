import type {
    OfficeTenure,
    Portfolio,
    RoleCategory,
    TravelStatus,
    TravelType,
} from "@/features/travel-explorer/types/travel.types";
import type { WorldRegion } from "@/types/geo.types";

export const ROLE_CATEGORIES = [
    "head_of_state",
    "head_of_government",
    "deputy_leader",
    "minister",
    "junior_minister",
    "senior_official",
] as const satisfies readonly RoleCategory[];

export const PORTFOLIOS = [
    "foreign_affairs",
    "finance",
    "trade",
    "defence",
    "home_affairs",
    "environment",
    "energy",
] as const satisfies readonly Portfolio[];

export const OFFICE_TENURES = ["current", "former"] as const satisfies readonly OfficeTenure[];

export const TRAVEL_TYPES = [
    "state_visit",
    "official_visit",
    "diplomatic_visit",
    "summit",
    "conference",
    "bilateral_meeting",
    "multilateral_meeting",
    "other",
] as const satisfies readonly TravelType[];

export const TRAVEL_STATUSES = [
    "completed",
    "upcoming",
    "planned",
    "cancelled",
] as const satisfies readonly TravelStatus[];

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

/** Lower rank sorts first when ordering officials by seniority. */
export const ROLE_RANK: Readonly<Record<RoleCategory, number>> = {
    deputy_leader: 2,
    head_of_government: 1,
    head_of_state: 0,
    junior_minister: 4,
    minister: 3,
    senior_official: 5,
};

/** Groups shown in the officials list, in display order. */
export const OFFICIAL_GROUPS = ["leadership", "ministers", "officials", "former"] as const;

/** Sections of the offices list; `vacant` holds offices nobody tracked currently holds. */
export const OFFICE_GROUPS = ["leadership", "ministers", "officials", "vacant"] as const;

/** Ways to look back at a country's former officials; the first is the default. */
export const FORMER_LAYOUTS = ["position", "year", "person"] as const;

/** Statuses that represent trips which have not happened yet. */
export const FUTURE_STATUSES: readonly TravelStatus[] = ["upcoming", "planned"];

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
 * Floating panel on the right of the map, below the header. Keep in sync with the
 * `sm:w-[380px]`, `xl:w-[420px]` and `*-3` classes on the panel.
 */
export const PANEL_WIDTH_PX = 380;
export const PANEL_WIDTH_XL_PX = 420;
export const PANEL_GAP_PX = 12;

/** Element id of the exploration panel, referenced by the toggle that shows and hides it. */
export const EXPLORER_PANEL_ID = "explorer-panel";

/** Number of upcoming trips listed in the global overview. */
export const OVERVIEW_UPCOMING_LIMIT = 6;

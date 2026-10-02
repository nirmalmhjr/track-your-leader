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

/** Statuses that represent trips which have not happened yet. */
export const FUTURE_STATUSES: readonly TravelStatus[] = ["upcoming", "planned"];

/** Number of steps in the sequential map shading scale. */
export const SEQUENTIAL_STEPS = 5;

export const MAP_CONFIG = {
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

/** Bottom sheet heights on small screens. */
export const SHEET_SNAP_POINTS = ["peek", "half", "full"] as const;

export const SHEET_PEEK_HEIGHT_PX = 148;
export const SHEET_HALF_RATIO = 0.52;
export const SHEET_TOP_GAP_PX = 64;

/** Number of upcoming trips listed in the global overview. */
export const OVERVIEW_UPCOMING_LIMIT = 6;

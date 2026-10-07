import type {
    OfficeTenure,
    Portfolio,
    RoleCategory,
    TravelStatus,
    TravelType,
} from "@/types/travel.types";

/*
 * The travel domain's vocabulary, shared by the explorer, the leaders directory and the data
 * pipeline. The app index stores roles and portfolios by their position in these lists, so new
 * values are only ever appended.
 */

export const ROLE_CATEGORIES = [
    "head_of_state",
    "head_of_government",
    "deputy_leader",
    "minister",
    "junior_minister",
    "senior_official",
    "legislator",
    "regional_leader",
    "local_leader",
    "judiciary",
    "diplomat",
    "central_banker",
    "military_leader",
    "party_leader",
] as const satisfies readonly RoleCategory[];

export const PORTFOLIOS = [
    "foreign_affairs",
    "finance",
    "trade",
    "defence",
    "home_affairs",
    "environment",
    "energy",
    "health",
    "education",
    "labour",
    "justice",
    "agriculture",
    "transport",
    "women",
    "youth",
    "culture",
    "tourism",
    "science",
    "social_affairs",
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
    // Last, so the numbers stored for the other types in index.json stay the same.
    "extended_stay",
] as const satisfies readonly TravelType[];

export const TRAVEL_STATUSES = [
    "completed",
    "upcoming",
    "planned",
    "cancelled",
] as const satisfies readonly TravelStatus[];

/** Lower rank sorts first when ordering officials by seniority. */
export const ROLE_RANK: Readonly<Record<RoleCategory, number>> = {
    central_banker: 5,
    deputy_leader: 2,
    diplomat: 6,
    head_of_government: 1,
    head_of_state: 0,
    judiciary: 8,
    junior_minister: 4,
    legislator: 7,
    local_leader: 9,
    military_leader: 5,
    minister: 3,
    party_leader: 6,
    regional_leader: 7,
    senior_official: 5,
};

/** Groups shown in the officials list, in display order. */
export const OFFICIAL_GROUPS = [
    "leadership",
    "ministers",
    "officials",
    "legislators",
    "regional",
    "judiciary",
    "former",
] as const;

/** Sections of the offices list; `vacant` holds offices nobody tracked currently holds. */
export const OFFICE_GROUPS = [
    "leadership",
    "ministers",
    "officials",
    "legislators",
    "regional",
    "judiciary",
    "vacant",
] as const;

/** Statuses that represent trips which have not happened yet. */
export const FUTURE_STATUSES: readonly TravelStatus[] = ["upcoming", "planned"];

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

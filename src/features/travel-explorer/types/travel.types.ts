import type { Coordinates, CountryCode, WorldRegion } from "@/types/geo.types";

/** Calendar date without a time component, formatted as `YYYY-MM-DD`. */
export type IsoDate = string;

/**
 * Generic office categories. Countries organise government differently, so a single position
 * may carry several categories (a US president is both head of state and head of government).
 */
export type RoleCategory =
    | "head_of_state"
    | "head_of_government"
    | "deputy_leader"
    | "minister"
    | "junior_minister"
    | "senior_official";

/** Normalised policy area of a ministerial position, independent of local ministry names. */
export type Portfolio =
    | "foreign_affairs"
    | "finance"
    | "defence"
    | "trade"
    | "home_affairs"
    | "environment"
    | "energy";

export type OfficeTenure = "current" | "former";

export type TravelType =
    | "state_visit"
    | "official_visit"
    | "diplomatic_visit"
    | "summit"
    | "conference"
    | "bilateral_meeting"
    | "multilateral_meeting"
    | "other";

export type TravelStatus = "completed" | "upcoming" | "planned" | "cancelled";

export interface Place {
    city: string;
    coordinates: Coordinates;
    countryCode: CountryCode;
    region: WorldRegion;
}

export interface TrackedCountry {
    capital: Place;
    code: CountryCode;
    governmentSystem: string;
    name: string;
}

export interface Position {
    categories: readonly RoleCategory[];
    /** `null` while the position is still held. */
    endDate: IsoDate | null;
    id: string;
    ministry: string | null;
    portfolio: Portfolio | null;
    startDate: IsoDate;
    title: string;
}

export interface Official {
    countryCode: CountryCode;
    fullName: string;
    id: string;
    party: string | null;
    photoUrl: string | null;
    /** Ordered from most recent to oldest. */
    positions: readonly Position[];
    summary: string;
}

export interface TravelRecord {
    destination: Place;
    endDate: IsoDate;
    engagements: readonly string[];
    eventName: string | null;
    id: string;
    officialId: string;
    origin: Place;
    originCountryCode: CountryCode;
    /** Title the official held when the trip took place. */
    positionTitle: string;
    purpose: string;
    startDate: IsoDate;
    status: TravelStatus;
    type: TravelType;
}

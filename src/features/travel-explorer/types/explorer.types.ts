import type {
    COUNTRY_VIEWS,
    DESTINATION_REGIONS,
    OFFICIAL_GROUPS,
    OFFICIAL_SORTS,
    SHEET_SNAP_POINTS,
} from "@/features/travel-explorer/constants/explorer.constants";
import type {
    IsoDate,
    OfficeTenure,
    Place,
    Portfolio,
    RoleCategory,
    TravelRecord,
    TravelStatus,
    TravelType,
} from "@/features/travel-explorer/types/travel.types";
import type { CountryCode } from "@/types/geo.types";

export type CountryView = (typeof COUNTRY_VIEWS)[number];
export type DestinationRegion = (typeof DESTINATION_REGIONS)[number];
export type OfficialSort = (typeof OFFICIAL_SORTS)[number];
export type OfficialGroup = (typeof OFFICIAL_GROUPS)[number];
export type SheetSnapPoint = (typeof SHEET_SNAP_POINTS)[number];

/** Every filter the explorer understands. Mirrors the URL query parameters one-to-one. */
export interface ExplorerFilters {
    city: string;
    destinations: CountryCode[];
    from: IsoDate | null;
    includePreviousPositions: boolean;
    name: string;
    party: string | null;
    portfolios: Portfolio[];
    regions: DestinationRegion[];
    roles: RoleCategory[];
    statuses: TravelStatus[];
    tenure: OfficeTenure | null;
    to: IsoDate | null;
    types: TravelType[];
}

export type ExplorerFilterKey = keyof ExplorerFilters;

export interface ExplorerSelection {
    country: CountryCode | null;
    official: string | null;
    trip: string | null;
    view: CountryView;
}

/** Explorer depth, from the world overview down to a single trip. */
export type ExplorerLevel = "world" | "country" | "official" | "trip";

export interface TravelSummary {
    countryCount: number;
    daysAbroad: number;
    lastTrip: TravelRecord | null;
    nextTrip: TravelRecord | null;
    tripCount: number;
    upcomingCount: number;
}

/** Trips sharing a destination city, used to draw one route and node per city. */
export interface DestinationAggregate {
    hasFuture: boolean;
    hasPast: boolean;
    key: string;
    latest: TravelRecord;
    onlyCancelled: boolean;
    place: Place;
    records: readonly TravelRecord[];
}

/** Trips sharing an origin and destination city, for inbound route drawing. */
export interface RouteAggregate {
    dominantStatus: TravelStatus;
    from: Place;
    key: string;
    records: readonly TravelRecord[];
    to: Place;
}

export interface SequentialScale {
    stepFor: (value: number) => number;
    /** Upper bound (inclusive) of each step; the last step is open-ended. */
    thresholds: readonly number[];
}

import type {
    COUNTRY_SORTS,
    COUNTRY_VIEWS,
    DESTINATION_REGIONS,
    FORMER_LAYOUTS,
    OFFICIAL_SORTS,
    SHEET_SNAPS,
} from "@/features/travel-explorer/constants/explorer.constants";
import type { MAP_STYLES } from "@/features/travel-explorer/constants/map-style.constants";
import type { CountryCode } from "@/types/geo.types";
import type {
    IsoDate,
    OfficeTenure,
    Place,
    Portfolio,
    RoleCategory,
    TravelRecord,
    TravelStatus,
    TravelType,
} from "@/types/travel.types";

export type CountrySort = (typeof COUNTRY_SORTS)[number];
export type CountryView = (typeof COUNTRY_VIEWS)[number];
export type DestinationRegion = (typeof DESTINATION_REGIONS)[number];
export type OfficialSort = (typeof OFFICIAL_SORTS)[number];
export type FormerLayout = (typeof FORMER_LAYOUTS)[number];
export type MapStyle = (typeof MAP_STYLES)[number];
export type SheetSnap = (typeof SHEET_SNAPS)[number];

/** Distance (px) the bottom sheet sits below its fully open position at each snap. */
export type SheetSnapOffsets = Record<SheetSnap, number>;

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

/**
 * Headline numbers of the world view for the current filters, in the shape of the planned
 * `GET /stats/world` response (`docs/mongodb-api.md`). Cancelled trips never happened, so they
 * appear only in `tripsByStatus`.
 */
export interface WorldStats {
    /** Officials passing the filters. */
    officialCount: number;
    /**
     * Officials on record in each country, whatever the filters. Shared heads of state count in
     * every country they head.
     */
    officialsByCountry: ReadonlyMap<CountryCode, number>;
    tripCount: number;
    tripsByOrigin: ReadonlyMap<CountryCode, number>;
    tripsByStatus: Readonly<Record<TravelStatus, number>>;
    /** Upcoming and planned trips. */
    upcomingCount: number;
    visitsByDestination: ReadonlyMap<CountryCode, number>;
}

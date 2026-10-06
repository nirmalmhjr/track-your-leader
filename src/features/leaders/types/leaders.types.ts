import type { COUNTRY_TABS } from "@/features/leaders/constants/leaders.constants";
import type { TenureBreakdown } from "@/lib/travel/offices.utils";
import type { CountryCode } from "@/types/geo.types";
import type {
    IsoDate,
    Official,
    TrackedCountry,
    TravelRecord,
    TravelSummary,
} from "@/types/travel.types";

export type CountryTab = (typeof COUNTRY_TABS)[number];

/** One row of the country rail. Names are localised in the browser from the code. */
export interface CountryListItem {
    code: CountryCode;
    inOfficeCount: number;
    officialCount: number;
    tripCount: number;
}

/** An official with the headline numbers of their travel. */
export interface LeaderEntry {
    official: Official;
    summary: TravelSummary;
}

/** The In office tab's sections, each most senior first. */
export interface InOfficeGroups {
    /** Heads of state and government and their deputies. */
    leadership: LeaderEntry[];
    ministers: LeaderEntry[];
    /** Everyone else in office: senior officials, diplomats, regional leaders, legislators. */
    others: LeaderEntry[];
}

/** Colour class of each party's chip and bar segment, by party name. */
export type PartyColors = ReadonlyMap<string, string>;

/** A tracked leader ranked by how much they travelled recently. */
export interface TopTraveller extends LeaderEntry {
    recentTripCount: number;
}

/** Everything the country page shows. */
export interface CountryDirectory {
    country: TrackedCountry;
    /** Officials holding an office today, most senior first. */
    inOffice: LeaderEntry[];
    /** Every official of the country, for the former-officials layouts. */
    officials: Official[];
    tenure: TenureBreakdown;
    tripCount: number;
}

/** The landing page: totals and the most travelled leaders in office. */
export interface DirectoryOverview {
    countryCount: number;
    officialCount: number;
    topTravellers: TopTraveller[];
    tripCount: number;
}

/** Everything the profile page shows. */
export interface OfficialProfile {
    country: TrackedCountry;
    official: Official;
    /** The official's trips, newest first, with purposes and sources where known. */
    records: TravelRecord[];
}

/** Values every directory page needs alongside its own data. */
export interface DirectoryContext {
    today: IsoDate;
    /** Day the data was last updated, or `null` for the samples. */
    updatedOn: IsoDate | null;
}

export interface YearCount {
    count: number;
    year: string;
}

export interface DestinationCount {
    count: number;
    countryCode: CountryCode;
}

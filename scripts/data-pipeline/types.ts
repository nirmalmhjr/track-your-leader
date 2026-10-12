import type { CountryCode } from "@/types/geo.types";
import type {
    DatePrecision,
    IsoDate,
    Place,
    Portfolio,
    RoleCategory,
    SourceRef,
    TravelType,
} from "@/types/travel.types";

/** A country's Wikidata identity and the offices of its leaders. */
export interface CountryContext {
    code: CountryCode;
    /**
     * Leader offices of the state this country alone succeeded, such as "King of Nepal" for the
     * Kingdom of Nepal: their holders since the horizon are the country's former leaders.
     */
    formerHeadOfGovernmentOffices: readonly string[];
    formerHeadOfStateOffices: readonly string[];
    headOfGovernmentOffice: string | null;
    headOfStateOffice: string | null;
    wikidataId: string;
}

/** One continuous term in an office, as recorded on Wikidata. */
export interface OfficeTerm {
    endDate: IsoDate | null;
    officeId: string;
    personId: string;
    startDate: IsoDate;
}

export interface PositionDraft {
    categories: RoleCategory[];
    /** The country the office belongs to (see `Position.countryCode`); absent: the official's. */
    countryCode?: CountryCode;
    endDate: IsoDate | null;
    ministry: string | null;
    portfolio: Portfolio | null;
    startDate: IsoDate | null;
    title: string;
    /** The source doesn't record when it ended (see `Position.undated`). */
    undated?: true;
}

/** An official before ids, photos and summaries are added. */
export interface OfficialDraft {
    /** Other spellings of the name (Wikidata aliases), used to match trips to people. */
    aliases: string[];
    countryCode: CountryCode;
    /** Name as published by the source that introduced the official. */
    name: string;
    positions: PositionDraft[];
    sources: SourceRef[];
    wikidataId: string | null;
}

/** Every source of trips the pipeline reads. */
export const TRIP_SOURCES = [
    "wikipedia",
    "colt",
    "historian",
    "historian-visits",
    "gov-uk",
    "canada",
    "nepal-mofa",
    "india-mea",
    "kremlin",
    "danish-court",
    "un-general-debate",
    "who-assembly",
    "uk-parliament",
    "au-ipea",
    "summits",
    "relations",
] as const;

export type TripSourceId = (typeof TRIP_SOURCES)[number];

/** Who a source says travelled. Sources name people differently, so every hint is kept. */
export interface TravellerHint {
    /** Role the source gives, used when the name is missing or ambiguous. */
    categories: RoleCategory[];
    countryCode: CountryCode;
    /** Family name on its own, when the source provides it (COLT). */
    familyName: string | null;
    /** `null` when the source names only the office ("the Prime Minister"). */
    name: string | null;
    portfolio: Portfolio | null;
    /** Office as written by the source. */
    title: string | null;
    wikidataId: string | null;
}

/**
 * One trip as one source reports it, before it is matched to an official and merged with
 * other sources' reports of the same trip.
 */
export interface TripClaim {
    datePrecision: DatePrecision;
    destination: Place;
    endDate: IsoDate;
    engagements: string[];
    eventName: string | null;
    purpose: string | null;
    source: TripSourceId;
    sourceRef: SourceRef;
    startDate: IsoDate;
    statusHint: "cancelled" | "planned" | null;
    traveller: TravellerHint;
    type: TravelType;
}

/** A row a source published that could not become a trip, for the report. */
export interface SkippedRow {
    reason: string;
    text: string;
}

/** What one source produced in a run. */
export interface SourceReport {
    claims: number;
    /** Claims matched to a known official, and claims that introduced a new one. */
    matched: number;
    newOfficials: number;
    skipped: SkippedRow[];
    skippedCount: number;
    unmatched: number;
}

/** Problems worth a human look, written to the warehouse's `report.json` after each run. */
export interface PipelineReport {
    cabinets: Record<CountryCode, { asOf: IsoDate | null; status: string }>;
    /** Photos shared by several people that were taken away from those they may not show. */
    droppedPhotos: { file: string; wikidataIds: string[] }[];
    sources: Partial<Record<TripSourceId, SourceReport>>;
    tripPages: {
        official: string;
        records: number;
        rowsSkipped: SkippedRow[];
        title: string;
    }[];
    /** Trips dated after the traveller's death or in their childhood: someone else's. */
    tripsOutsideLifetime: string[];
    /** Trips whose source mistyped a year, with the dates they were read as. */
    tripYearsRepaired: string[];
    unmatchedOfficials: string[];
}

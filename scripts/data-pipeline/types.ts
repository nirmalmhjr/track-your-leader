import type {
    IsoDate,
    Portfolio,
    RoleCategory,
    SourceRef,
} from "@/features/travel-explorer/types/travel.types";
import type { CountryCode } from "@/types/geo.types";

/** A tracked country's Wikidata identity and the offices of its leaders. */
export interface CountryContext {
    code: CountryCode;
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
    endDate: IsoDate | null;
    ministry: string | null;
    portfolio: Portfolio | null;
    startDate: IsoDate | null;
    title: string;
}

/** An official before ids, photos and summaries are added. */
export interface OfficialDraft {
    countryCode: CountryCode;
    /** Name as published by the source that introduced the official. */
    name: string;
    positions: PositionDraft[];
    sources: SourceRef[];
    wikidataId: string | null;
}

/** Problems worth a human look, written to `state/report.json` after each run. */
export interface PipelineReport {
    cabinets: Record<CountryCode, { asOf: IsoDate | null; status: string }>;
    tripPages: {
        official: string;
        records: number;
        rowsSkipped: { reason: string; text: string }[];
        title: string;
    }[];
    unmatchedOfficials: string[];
}

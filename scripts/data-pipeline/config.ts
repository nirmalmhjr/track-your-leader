import type { CountryCode } from "@/types/geo.types";

/** Settings shared by every pipeline step. */
export const PIPELINE_CONFIG = {
    /** Local HTTP cache, so repeated runs on one machine don't refetch everything. */
    cacheDir: "scripts/data-pipeline/.cache",
    cacheTtlHours: 20,
    /** Days before an official the pipeline couldn't match on Wikidata is searched again. */
    identityRetryDays: 30,
    /** Abort (without writing) if officials or trips drop by more than this share. */
    maxCountDropRatio: 0.2,
    /** Files the app reads. */
    outputDir: "src/features/travel-explorer/data/generated",
    /** Trips that started before this year are ignored. */
    sinceYear: 2014,
    /** Pipeline memory between runs (who held which office since when) and the last report. */
    stateDir: "scripts/data-pipeline/state",
    /**
     * Wikimedia asks automated clients to identify themselves with a way to reach the operator.
     * Set DATA_PIPELINE_CONTACT to your site URL or email (also as a GitHub Actions secret).
     */
    userAgent: `TrackYourLeaderDataBot/1.0 (${process.env.DATA_PIPELINE_CONTACT ?? "contact: set DATA_PIPELINE_CONTACT"})`,
} as const;

export interface CountrySourceConfig {
    /** Page slug on the CIA World Leaders site, or `null` where it has no page (the US). */
    ciaSlug: string | null;
    /**
     * Whether to track the head of state. Commonwealth realms share the British monarch, who
     * travels as King of the United Kingdom, so their head of state is skipped.
     */
    includeHeadOfState: boolean;
    /** Extra offices read from Wikidata by English label, for countries the CIA doesn't cover. */
    wikidataOffices?: readonly string[];
}

/** Where each tracked country's officials come from (keys match `TRACKED_COUNTRIES`). */
export const COUNTRY_SOURCES: Readonly<Record<CountryCode, CountrySourceConfig>> = {
    AUS: { ciaSlug: "australia", includeHeadOfState: false },
    BGD: { ciaSlug: "bangladesh", includeHeadOfState: true },
    BRA: { ciaSlug: "brazil", includeHeadOfState: true },
    CAN: { ciaSlug: "canada", includeHeadOfState: false },
    CHN: { ciaSlug: "china", includeHeadOfState: true },
    DEU: { ciaSlug: "germany", includeHeadOfState: true },
    EGY: { ciaSlug: "egypt", includeHeadOfState: true },
    FRA: { ciaSlug: "france", includeHeadOfState: true },
    GBR: { ciaSlug: "united-kingdom", includeHeadOfState: true },
    IDN: { ciaSlug: "indonesia", includeHeadOfState: true },
    IND: { ciaSlug: "india", includeHeadOfState: true },
    ITA: { ciaSlug: "italy", includeHeadOfState: true },
    JPN: { ciaSlug: "japan", includeHeadOfState: true },
    KEN: { ciaSlug: "kenya", includeHeadOfState: true },
    KOR: { ciaSlug: "korea-south", includeHeadOfState: true },
    LKA: { ciaSlug: "sri-lanka", includeHeadOfState: true },
    MEX: { ciaSlug: "mexico", includeHeadOfState: true },
    NGA: { ciaSlug: "nigeria", includeHeadOfState: true },
    NPL: { ciaSlug: "nepal", includeHeadOfState: true },
    NZL: { ciaSlug: "new-zealand", includeHeadOfState: false },
    TUR: { ciaSlug: "turkey", includeHeadOfState: true },
    UKR: { ciaSlug: "ukraine", includeHeadOfState: true },
    USA: {
        ciaSlug: null,
        includeHeadOfState: true,
        wikidataOffices: [
            "Vice President of the United States",
            "United States Secretary of State",
            "United States Secretary of the Treasury",
            "United States Secretary of Defense",
            "United States Attorney General",
            "United States Secretary of Homeland Security",
            "United States Secretary of Commerce",
            "United States Secretary of Energy",
            "United States Trade Representative",
        ],
    },
    ZAF: { ciaSlug: "south-africa", includeHeadOfState: true },
};

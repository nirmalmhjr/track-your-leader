import type { CountryCode } from "@/types/geo.types";

/** Settings shared by every pipeline step. */
export const PIPELINE_CONFIG = {
    /** Large files (COLT spreadsheet, Canada's CSV) are reused for this long. */
    bulkCacheTtlHours: 24 * 7,
    /** Local HTTP cache, so repeated runs on one machine don't refetch everything. */
    cacheDir: "scripts/data-pipeline/.cache",
    cacheTtlHours: 20,
    /** Each country's officials and trips, served to the app as they are. */
    countriesDir: "public/data/countries",
    /** Days before an official the pipeline couldn't match on Wikidata is searched again. */
    identityRetryDays: 30,
    /** The compact index of every country, official and trip the app loads first. */
    indexFile: "public/data/index.json",
    /** Abort (without writing) if officials or trips drop by more than this share. */
    maxCountDropRatio: 0.2,
    /** Everyone else on record per country, unpacked from the warehouse for the app. */
    peopleDir: "public/data/people",
    /** Pipeline memory between runs (who held which office since when). */
    stateDir: "scripts/data-pipeline/state",
    /**
     * Wikimedia asks automated clients to identify themselves with a way to reach the operator;
     * without it, Wikidata and Wikipedia throttle the pipeline heavily. The project's repository
     * by default, or DATA_PIPELINE_CONTACT (a site URL) to override it.
     */
    userAgent: `TrackYourLeaderDataBot/1.0 (${process.env.DATA_PIPELINE_CONTACT ?? "https://github.com/nirmalmhjr/track-your-leader"})`,
    /** Everything collected, for every country and year (`pnpm data:collect`). */
    warehouseDir: "data/warehouse",
    /** Offices held since this year are collected into the warehouse by default. */
    warehouseSinceYear: 1945,
} as const;

export interface CountrySourceConfig {
    /**
     * Whether to track the head of state. Commonwealth realms share the British monarch, who
     * travels as King of the United Kingdom, so their head of state is skipped.
     */
    includeHeadOfState: boolean;
    /** Set to `false` where the CIA has no page (the US); otherwise found from its index. */
    useCia: boolean;
    /** Extra offices read from Wikidata by English label, for countries the CIA doesn't cover. */
    wikidataOffices?: readonly string[];
}

/**
 * Realms whose head of state is the British monarch (the UK itself tracks the monarch), and the
 * Cook Islands and Niue, whose head of state is the monarch in right of New Zealand. Tracking
 * the monarch there too would file the monarch, and the royal trips, under that country.
 */
const COMMONWEALTH_REALMS: ReadonlySet<CountryCode> = new Set([
    "ATG",
    "AUS",
    "BHS",
    "BLZ",
    "CAN",
    "COK",
    "GRD",
    "JAM",
    "KNA",
    "LCA",
    "NIU",
    "NZL",
    "PNG",
    "SLB",
    "TUV",
    "VCT",
]);

/** Countries that need more than the defaults. */
const COUNTRY_OVERRIDES: Readonly<Record<CountryCode, Partial<CountrySourceConfig>>> = {
    USA: {
        useCia: false,
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
};

/**
 * Where a country's officials come from. Every country uses Wikidata for leaders and
 * ministers' terms and the CIA list for its current cabinet unless overridden here.
 *
 * @param code - ISO alpha-3 country code.
 * @returns The country's source settings.
 */
export const countrySourceFor = (code: CountryCode): CountrySourceConfig => ({
    includeHeadOfState: !COMMONWEALTH_REALMS.has(code),
    useCia: true,
    ...COUNTRY_OVERRIDES[code],
});

import { TRACKED_COUNTRIES } from "@/features/travel-explorer/data/tracked-countries";
import { ALL_COUNTRY_REFERENCES, getCountryReference } from "@/lib/geo/country-reference";
import type { CountryCode } from "@/types/geo.types";

import { log } from "../lib/log";
import { normalizeName } from "../lib/text";
import { ciaSlugOf, fetchCiaCountryNames } from "../sources/cia-world-leaders";
import { runSparql } from "../sources/wikidata";

/** Wikidata class "sovereign state". */
const SOVEREIGN_STATE = "Q3624078";

/** CIA names that differ from the ISO short names. */
const CIA_NAME_ALIASES: Readonly<Record<string, CountryCode>> = {
    "bahamas the": "BHS",
    burma: "MMR",
    "cabo verde": "CPV",
    "congo democratic republic of the": "COD",
    "congo republic of the": "COG",
    "cote d ivoire": "CIV",
    "gambia the": "GMB",
    "holy see vatican city": "VAT",
    "korea north": "PRK",
    "korea south": "KOR",
    kosovo: "XKX",
    "micronesia federated states of": "FSM",
    turkey: "TUR",
};

export interface CountryList {
    /** CIA page slug per country, for those the CIA covers. */
    ciaSlugs: Map<CountryCode, string>;
    codes: CountryCode[];
}

const codeOfCiaName = (name: string): CountryCode | null => {
    const key = normalizeName(name);
    return (
        CIA_NAME_ALIASES[key] ??
        ALL_COUNTRY_REFERENCES.find((reference) => normalizeName(reference.name) === key)?.alpha3 ??
        null
    );
};

const fetchCiaSlugs = async (): Promise<Map<CountryCode, string>> => {
    const slugs = new Map<CountryCode, string>();
    try {
        for (const name of await fetchCiaCountryNames()) {
            const code = codeOfCiaName(name);
            if (code) {
                slugs.set(code, ciaSlugOf(name));
            } else {
                log.warn(`CIA country not recognised: ${name}`);
            }
        }
    } catch (error) {
        log.warn(`CIA country index unavailable: ${(error as Error).message}`);
    }
    return slugs;
};

const fetchSovereignStates = async (): Promise<CountryCode[]> => {
    const rows = await runSparql(`
        SELECT DISTINCT ?iso WHERE { ?country wdt:P31 wd:${SOVEREIGN_STATE} ; wdt:P298 ?iso . }`);
    return rows.flatMap((row) => (row.iso && getCountryReference(row.iso) ? [row.iso] : []));
};

/**
 * Countries a run covers.
 *
 * @param selection - `all` (every sovereign state plus every government the CIA lists),
 *   `tracked` (the app's countries) or explicit ISO codes.
 * @returns The codes, sorted, and the CIA slug of each that has a CIA page.
 */
export const resolveCountries = async (
    selection: "all" | "tracked" | readonly CountryCode[]
): Promise<CountryList> => {
    const ciaSlugs = await fetchCiaSlugs();
    let codes: CountryCode[];
    if (selection === "all") {
        codes = [...new Set([...(await fetchSovereignStates()), ...ciaSlugs.keys()])];
    } else if (selection === "tracked") {
        codes = TRACKED_COUNTRIES.map((country) => country.code);
    } else {
        codes = [...selection];
    }
    return { ciaSlugs, codes: codes.sort() };
};

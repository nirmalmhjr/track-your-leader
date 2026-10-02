import type { CountryCode, WorldRegion } from "@/types/geo.types";

import { COUNTRY_REFERENCE_ROWS } from "./country-reference-rows";

export interface CountryReference {
    alpha2: string;
    alpha3: CountryCode;
    capital: string;
    name: string;
    numericCode: string | null;
    region: WorldRegion;
    subregion: string;
}

/**
 * Territories that Natural Earth draws but that have no ISO numeric code, keyed by the
 * topology's feature name.
 */
const UNCODED_TERRITORIES: Readonly<Record<string, CountryReference>> = {
    Kosovo: {
        alpha2: "XK",
        alpha3: "XKX",
        capital: "Pristina",
        name: "Kosovo",
        numericCode: null,
        region: "Europe",
        subregion: "Southeast Europe",
    },
};

const references: CountryReference[] = [
    ...COUNTRY_REFERENCE_ROWS.map(
        ([numericCode, alpha2, alpha3, name, capital, region, subregion]) => ({
            alpha2,
            alpha3,
            capital,
            name,
            numericCode,
            region,
            subregion,
        })
    ),
    ...Object.values(UNCODED_TERRITORIES),
];

const byAlpha3 = new Map(references.map((reference) => [reference.alpha3, reference]));
const byNumeric = new Map(
    references.flatMap((reference) =>
        reference.numericCode ? [[reference.numericCode, reference] as const] : []
    )
);

/**
 * Looks up reference metadata for an ISO alpha-3 country code.
 *
 * @param alpha3 - ISO 3166-1 alpha-3 code.
 * @returns The matching reference, or `undefined` for unknown codes.
 */
export const getCountryReference = (alpha3: CountryCode): CountryReference | undefined =>
    byAlpha3.get(alpha3);

/**
 * Resolves a map topology feature to its country reference. Features are matched by ISO numeric
 * id first and fall back to the feature name for territories without an ISO code.
 *
 * @param numericId - ISO numeric id attached to the feature, if any.
 * @param featureName - English name stored on the feature.
 * @returns The matching reference, or `undefined` when the feature is not a recognised country.
 */
export const resolveFeatureReference = (
    numericId: string | undefined,
    featureName: string
): CountryReference | undefined => {
    if (numericId) {
        return byNumeric.get(numericId);
    }

    return UNCODED_TERRITORIES[featureName];
};

/**
 * Returns the region a country belongs to. Unknown codes throw so that bad seed data surfaces
 * immediately instead of silently landing in the wrong region.
 *
 * @param alpha3 - ISO 3166-1 alpha-3 code.
 * @returns The country's world region.
 */
export const getCountryRegion = (alpha3: CountryCode): WorldRegion => {
    const reference = byAlpha3.get(alpha3);

    if (!reference) {
        throw new Error(`Unknown country code "${alpha3}"`);
    }

    return reference.region;
};

/** Every reference entry, sorted by English name. */
export const ALL_COUNTRY_REFERENCES: readonly CountryReference[] = [...references].sort((a, b) =>
    a.name.localeCompare(b.name)
);

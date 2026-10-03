import { TRACKED_COUNTRIES } from "@/features/travel-explorer/data/tracked-countries";
import type { Place } from "@/features/travel-explorer/types/travel.types";
import {
    ALL_COUNTRY_REFERENCES,
    getCountryReference,
    getCountryRegion,
} from "@/lib/geo/country-reference";
import type { Coordinates, CountryCode } from "@/types/geo.types";

import { chunk } from "../lib/collections";
import { normalizeName } from "../lib/text";
import { entityId, parsePoint, runSparql } from "../sources/wikidata";
import { fetchWikidataIds } from "../sources/wikipedia";
import type { CellLink, TableCell } from "./trip-tables.parse";

/**
 * Locates trip destinations. Links in the country and city cells point to Wikipedia articles;
 * their Wikidata items give the country (ISO code) and the city's coordinates. When a row
 * names no city that can be located, the trip is placed at the country's capital.
 */

const SPARQL_BATCH_SIZE = 200;
const COUNTRY_LIST_SEPARATOR = /[,;/]| and /;

/** Common names in Wikipedia tables that differ from the ISO short names. */
const COUNTRY_ALIASES: Readonly<Record<string, CountryCode>> = {
    "czech republic": "CZE",
    "democratic republic of the congo": "COD",
    "east timor": "TLS",
    "ivory coast": "CIV",
    "north korea": "PRK",
    "people s republic of china": "CHN",
    "republic of ireland": "IRL",
    "republic of the congo": "COG",
    russia: "RUS",
    "south korea": "KOR",
    "the bahamas": "BHS",
    "the gambia": "GMB",
    "the netherlands": "NLD",
    turkey: "TUR",
    uk: "GBR",
    "united states of america": "USA",
    us: "USA",
    usa: "USA",
    "vatican city": "VAT",
    vietnam: "VNM",
};

interface ItemInfo {
    coordinates: Coordinates | null;
    countryCode: CountryCode | null;
}

export interface PlaceResolver {
    /** Destinations of a row, one per country, excluding the traveller's own country. */
    destinationsOf: (
        row: { cities: TableCell | null; country: TableCell | null },
        home: CountryCode
    ) => Place[];
}

const countryCodeByName = (): Map<string, CountryCode> => {
    const names = new Map<string, CountryCode>();
    for (const reference of ALL_COUNTRY_REFERENCES) {
        names.set(normalizeName(reference.name), reference.alpha3);
    }
    for (const [name, code] of Object.entries(COUNTRY_ALIASES)) {
        names.set(name, code);
    }
    return names;
};

/** Every country's Wikidata item, ISO code and capital coordinates in one query. */
const fetchCountries = async (): Promise<{
    capitals: Map<CountryCode, Place>;
    codeByItem: Map<string, CountryCode>;
}> => {
    const rows = await runSparql(`
        SELECT ?country ?iso ?countryLabel ?countryCoord ?capitalLabel ?coord WHERE {
            ?country wdt:P298 ?iso .
            OPTIONAL { ?country wdt:P625 ?countryCoord }
            OPTIONAL {
                ?country p:P36 ?capitalStatement .
                ?capitalStatement ps:P36 ?capital .
                FILTER NOT EXISTS { ?capitalStatement pq:P582 ?ended }
                ?capital wdt:P625 ?coord .
            }
            SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul". }
        } ORDER BY ?iso ?capitalLabel`);

    // Tracked countries use the capital the app already shows; others take Wikidata's.
    const capitals = new Map<CountryCode, Place>(
        TRACKED_COUNTRIES.map((country) => [country.code, country.capital])
    );
    const fallbacks = new Map<CountryCode, Place>();
    const codeByItem = new Map<string, CountryCode>();
    for (const row of rows) {
        const item = entityId(row.country);
        const code = row.iso;
        if (!(item && code && getCountryReference(code))) {
            continue;
        }
        codeByItem.set(item, code);
        const coordinates = parsePoint(row.coord);
        if (coordinates && row.capitalLabel && !capitals.has(code)) {
            capitals.set(code, {
                city: row.capitalLabel,
                coordinates,
                countryCode: code,
                region: getCountryRegion(code),
            });
        }
        // Territories without a capital (Hong Kong, Macau) use their own location.
        const ownCoordinates = parsePoint(row.countryCoord);
        if (ownCoordinates && row.countryLabel && !fallbacks.has(code)) {
            fallbacks.set(code, {
                city: row.countryLabel,
                coordinates: ownCoordinates,
                countryCode: code,
                region: getCountryRegion(code),
            });
        }
    }
    for (const [code, place] of fallbacks) {
        if (!capitals.has(code)) {
            capitals.set(code, place);
        }
    }
    return { capitals, codeByItem };
};

/** Coordinates and country of linked articles (cities, venues). */
const fetchItems = async (
    items: readonly string[],
    codeByItem: ReadonlyMap<string, CountryCode>
): Promise<Map<string, ItemInfo>> => {
    const info = new Map<string, ItemInfo>();
    const batches = chunk([...new Set(items)].sort(), SPARQL_BATCH_SIZE);
    const results = await Promise.all(
        batches.map((batch) =>
            runSparql(`
                SELECT ?item ?coord ?country WHERE {
                    VALUES ?item { ${batch.map((id) => `wd:${id}`).join(" ")} }
                    OPTIONAL { ?item wdt:P625 ?coord }
                    OPTIONAL { ?item wdt:P17 ?country }
                }`)
        )
    );
    for (const row of results.flat()) {
        const item = entityId(row.item);
        if (!item || info.get(item)?.coordinates) {
            continue;
        }
        const country = entityId(row.country);
        info.set(item, {
            coordinates: parsePoint(row.coord),
            countryCode: country ? (codeByItem.get(country) ?? null) : null,
        });
    }
    return info;
};

/**
 * Prepares a resolver for all links found on the trip pages.
 *
 * @param links - Every link from country and city cells.
 * @returns A resolver that turns rows into destination places.
 */
export const buildPlaceResolver = async (links: readonly CellLink[]): Promise<PlaceResolver> => {
    const { capitals, codeByItem } = await fetchCountries();
    const itemByTitle = await fetchWikidataIds(links.map((link) => link.title));
    const items = await fetchItems(
        [...itemByTitle.values()].filter((item) => !codeByItem.has(item)),
        codeByItem
    );
    const names = countryCodeByName();

    const countryOfLink = (link: CellLink): CountryCode | null => {
        const item = itemByTitle.get(link.title);
        return (item && codeByItem.get(item)) || names.get(normalizeName(link.text)) || null;
    };

    const cityOfLink = (link: CellLink): Place | null => {
        const item = itemByTitle.get(link.title);
        const info = item ? items.get(item) : undefined;
        if (!(info?.coordinates && info.countryCode)) {
            return null;
        }
        return {
            city: link.text || link.title,
            coordinates: info.coordinates,
            countryCode: info.countryCode,
            region: getCountryRegion(info.countryCode),
        };
    };

    const countriesInText = (text: string): CountryCode[] =>
        text.split(COUNTRY_LIST_SEPARATOR).flatMap((part) => names.get(normalizeName(part)) ?? []);

    return {
        destinationsOf: (row, home) => {
            const cities = (row.cities?.links ?? []).flatMap((link) => cityOfLink(link) ?? []);
            const listed = row.country
                ? [
                      ...row.country.links.flatMap((link) => countryOfLink(link) ?? []),
                      ...countriesInText(row.country.text),
                  ]
                : [];
            // Tables with a single "Location" column list cities only; their countries count too.
            const countries = listed.length > 0 ? listed : cities.map((city) => city.countryCode);

            return [...new Set(countries)]
                .filter((code) => code !== home)
                .flatMap((code) => {
                    const place =
                        cities.find((city) => city.countryCode === code) ?? capitals.get(code);
                    return place ? [place] : [];
                });
        },
    };
};

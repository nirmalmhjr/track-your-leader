import path from "node:path";

import { z } from "zod";

import { placeSchema } from "@/features/travel-explorer/data/generated-data.schema";
import { TRACKED_COUNTRIES } from "@/features/travel-explorer/data/tracked-countries";
import {
    ALL_COUNTRY_REFERENCES,
    getCountryReference,
    getCountryRegion,
} from "@/lib/geo/country-reference";
import type { Coordinates, CountryCode } from "@/types/geo.types";
import type { Place } from "@/types/travel.types";

import { PIPELINE_CONFIG } from "../config";
import { chunk } from "../lib/collections";
import { readJsonFile, writeJsonFile } from "../lib/json-file";
import { normalizeName, stripParenthetical } from "../lib/text";
import { entityId, parsePoint, runSparql } from "../sources/wikidata";
import { fetchWikidataIds, type WikiLanguage } from "../sources/wikipedia";
import type { CellLink, TableCell } from "./trip-tables.parse";

/**
 * Locates trip destinations. Wikipedia rows link their places, so their Wikidata items give
 * the country and the city's coordinates; other sources name cities in plain text, which is
 * looked up on Wikidata by name within the country. When no city can be located the trip is
 * placed at the country's capital, marked as country-precision so no city is claimed.
 */

const SPARQL_BATCH_SIZE = 200;
const CITY_BATCH_SIZE = 40;
const COUNTRY_LIST_SEPARATOR = /[,;/&]| and /;
const LEADING_THE = /^the /;

/** Common and historical names that differ from the ISO short names. */
const COUNTRY_ALIASES: Readonly<Record<string, CountryCode>> = {
    burma: "MMR",
    "cabo verde": "CPV",
    "cape verde": "CPV",
    ceylon: "LKA",
    "czech republic": "CZE",
    czechoslovakia: "CZE",
    "democratic republic of the congo": "COD",
    "east germany": "DEU",
    "east timor": "TLS",
    "federal republic of germany": "DEU",
    "federated states of micronesia": "FSM",
    "german democratic republic": "DEU",
    "great britain": "GBR",
    holland: "NLD",
    "holy see": "VAT",
    "ivory coast": "CIV",
    "korea republic of": "KOR",
    "north korea": "PRK",
    "people s republic of china": "CHN",
    persia: "IRN",
    "republic of china": "TWN",
    "republic of ireland": "IRL",
    "republic of korea": "KOR",
    "republic of the congo": "COG",
    rhodesia: "ZWE",
    russia: "RUS",
    "russian federation": "RUS",
    "south korea": "KOR",
    "south vietnam": "VNM",
    "soviet union": "RUS",
    swaziland: "SWZ",
    "the bahamas": "BHS",
    "the gambia": "GMB",
    "the netherlands": "NLD",
    turkey: "TUR",
    turkiye: "TUR",
    uk: "GBR",
    "united states of america": "USA",
    us: "USA",
    usa: "USA",
    ussr: "RUS",
    "vatican city": "VAT",
    vietnam: "VNM",
    "west germany": "DEU",
    yugoslavia: "SRB",
    zaire: "COD",
};

const NAMES = ((): Map<string, CountryCode> => {
    const names = new Map<string, CountryCode>();
    for (const reference of ALL_COUNTRY_REFERENCES) {
        names.set(normalizeName(reference.name), reference.alpha3);
    }
    for (const [name, code] of Object.entries(COUNTRY_ALIASES)) {
        names.set(name, code);
    }
    return names;
})();

/**
 * Finds the country a name refers to, including historical names (the Soviet Union counts as
 * Russia, its successor state).
 *
 * @param name - Country name as written in a source.
 * @returns The ISO code, or `null`.
 */
export const countryCodeOfName = (name: string): CountryCode | null =>
    NAMES.get(normalizeName(name).replace(LEADING_THE, "")) ??
    // Article titles such as "Georgia (country)".
    NAMES.get(normalizeName(stripParenthetical(name)).replace(LEADING_THE, "")) ??
    null;

/**
 * Every country named in a list such as "France, Belgium and the Netherlands".
 *
 * @param text - Free text.
 * @returns The ISO codes found, in order.
 */
export const countriesInText = (text: string): CountryCode[] =>
    text.split(COUNTRY_LIST_SEPARATOR).flatMap((part) => countryCodeOfName(part) ?? []);

/** Every country's Wikidata item and capital, loaded once per run. */
export interface PlaceIndex {
    capitals: Map<CountryCode, Place>;
    codeByItem: Map<string, CountryCode>;
    itemByCode: Map<CountryCode, string>;
}

/**
 * Loads every country's Wikidata item, ISO code and capital coordinates in one query.
 *
 * @returns The index.
 */
export const loadPlaceIndex = async (): Promise<PlaceIndex> => {
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
    const itemByCode = new Map<CountryCode, string>();
    for (const row of rows) {
        const item = entityId(row.country);
        const code = row.iso;
        if (!(item && code && getCountryReference(code))) {
            continue;
        }
        codeByItem.set(item, code);
        if (!itemByCode.has(code)) {
            itemByCode.set(code, item);
        }
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
    return { capitals, codeByItem, itemByCode };
};

const capitalsFile = path.join(PIPELINE_CONFIG.warehouseDir, "places", "capitals.json");

/**
 * Stores every country's capital, so the app index can be rebuilt without network access.
 *
 * @param index - Place index of this run.
 */
export const saveCapitals = async (index: PlaceIndex): Promise<void> => {
    await writeJsonFile(capitalsFile, Object.fromEntries(index.capitals));
};

/**
 * Reads the capitals stored by the last run.
 *
 * @returns Capital per country code.
 */
export const readCapitals = async (): Promise<Map<CountryCode, Place>> =>
    new Map(
        Object.entries((await readJsonFile(capitalsFile, z.record(z.string(), placeSchema))) ?? {})
    );

/**
 * A destination known only by its country: drawn at the capital, labelled as the country.
 *
 * @param index - Place index.
 * @param code - Country code.
 * @returns The place, or `null` when the country has no known location.
 */
export const countryPlace = (index: PlaceIndex, code: CountryCode): Place | null => {
    const capital = index.capitals.get(code);
    return capital ? { ...capital, precision: "country" } : null;
};

// --- Cities named in plain text -------------------------------------------------------------

const cityKey = (code: CountryCode, name: string): string => `${code}:${normalizeName(name)}`;
const cityCacheFile = path.join(PIPELINE_CONFIG.warehouseDir, "places", "cities.json");
const cityCacheSchema = z.record(z.string(), placeSchema.nullable());

/** Looks cities up by name on Wikidata, remembering every answer (including "not found"). */
export interface CityLookup {
    /** Resolves every pending name; call once after all `request`s. */
    load: () => Promise<void>;
    /** A city that `load` located, or `null`. */
    place: (code: CountryCode, name: string) => Place | null;
    /** Queues a city name for lookup. */
    request: (code: CountryCode, name: string) => void;
    /** Writes the lookup cache to the warehouse. */
    save: () => Promise<void>;
}

/**
 * Creates a city lookup backed by `data/warehouse/places/cities.json`, so each name is
 * queried once across runs. Names match labels or aliases of items located in the country;
 * among several, the best-known item (most Wikipedia articles) wins.
 *
 * @param index - Place index.
 * @returns The lookup.
 */
export const createCityLookup = async (index: PlaceIndex): Promise<CityLookup> => {
    const cache: Record<string, Place | null> =
        (await readJsonFile(cityCacheFile, cityCacheSchema)) ?? {};
    const pending = new Map<string, { code: CountryCode; name: string }>();

    const load = async (): Promise<void> => {
        const batches = chunk([...pending.values()], CITY_BATCH_SIZE);
        pending.clear();
        const results = await Promise.all(
            batches.map((batch) =>
                runSparql(`
                    SELECT ?name ?country ?coord ?links WHERE {
                        VALUES (?name ?country) { ${batch
                            .flatMap(({ code, name }) => {
                                const item = index.itemByCode.get(code);
                                return item ? [`(${JSON.stringify(name)}@en wd:${item})`] : [];
                            })
                            .join(" ")} }
                        ?item rdfs:label|skos:altLabel ?name ; wdt:P17 ?country ; wdt:P625 ?coord .
                        ?item wikibase:sitelinks ?links .
                    }`).then((rows) => ({ batch, rows }))
            )
        );
        for (const { batch, rows } of results) {
            for (const { code, name } of batch) {
                const item = index.itemByCode.get(code);
                const [best] = rows
                    .filter((row) => row.name === name && entityId(row.country) === item)
                    .sort((a, b) => Number(b.links) - Number(a.links));
                const coordinates = parsePoint(best?.coord);
                cache[cityKey(code, name)] = coordinates
                    ? { city: name, coordinates, countryCode: code, region: getCountryRegion(code) }
                    : null;
            }
        }
    };

    return {
        load,
        place: (code, name) => cache[cityKey(code, name)] ?? null,
        request: (code, name) => {
            const key = cityKey(code, name);
            if (name.trim() && !(key in cache) && index.itemByCode.has(code)) {
                pending.set(key, { code, name: name.trim() });
            }
        },
        save: async () => {
            await writeJsonFile(cityCacheFile, cache);
        },
    };
};

// --- Wikipedia table rows -------------------------------------------------------------------

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
    /**
     * Reads a row of visits someone hosted: the visiting countries, and where they went (a
     * linked venue in the host country, or the host country itself).
     */
    visitsTo: (
        row: { cities: TableCell | null; country: TableCell | null },
        host: CountryCode
    ) => { destination: Place | null; visitors: CountryCode[] };
}

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
 * @param index - Place index.
 * @param language - Wikipedia the links point into.
 * @returns A resolver that turns rows into destination places.
 */
export const buildPlaceResolver = async (
    links: readonly CellLink[],
    index: PlaceIndex,
    language: WikiLanguage = "en"
): Promise<PlaceResolver> => {
    const { codeByItem } = index;
    const itemByTitle = await fetchWikidataIds(
        links.map((link) => link.title),
        language
    );
    const items = await fetchItems(
        [...itemByTitle.values()].filter((item) => !codeByItem.has(item)),
        codeByItem
    );

    /**
     * A linked country, or the country a linked place lies in ("Georgia (U.S. state)" is in
     * the US, not Georgia). Only an unresolved link is read by its text.
     */
    const countryOfLink = (link: CellLink): CountryCode | null => {
        const item = itemByTitle.get(link.title);
        if (!item) {
            return countryCodeOfName(link.text);
        }
        return codeByItem.get(item) ?? items.get(item)?.countryCode ?? null;
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

    const countriesOf = (
        row: { cities: TableCell | null; country: TableCell | null },
        home: CountryCode
    ) => {
        const cities = (row.cities?.links ?? []).flatMap((link) => cityOfLink(link) ?? []);
        // Linked names are read by their links, which may lead to a state ("Georgia"); only the
        // text outside the links is read for country names.
        const countryLinks = row.country?.links ?? [];
        const unlinkedText = countryLinks.reduce(
            (text, link) => text.replace(link.text, " "),
            row.country?.text ?? ""
        );
        const listed = [
            ...countryLinks.flatMap((link) => countryOfLink(link) ?? []),
            ...countriesInText(unlinkedText).filter(
                // Unlinked "Georgia" on an American's page is the state (domestic travel).
                (code) => !(home === "USA" && code === "GEO")
            ),
        ];
        return { cities, listed };
    };

    return {
        destinationsOf: (row, home) => {
            const { cities, listed } = countriesOf(row, home);
            // Tables with a single "Location" column list cities only; their countries count too.
            const countries = listed.length > 0 ? listed : cities.map((city) => city.countryCode);

            return [...new Set(countries)]
                .filter((code) => code !== home)
                .flatMap((code) => {
                    const place =
                        cities.find((city) => city.countryCode === code) ??
                        countryPlace(index, code);
                    return place ? [place] : [];
                });
        },
        visitsTo: (row, host) => {
            const { cities, listed } = countriesOf(row, host);
            return {
                destination:
                    cities.find((city) => city.countryCode === host) ?? countryPlace(index, host),
                visitors: [...new Set(listed)].filter((code) => code !== host),
            };
        },
    };
};

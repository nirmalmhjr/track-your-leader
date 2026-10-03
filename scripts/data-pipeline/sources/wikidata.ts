import { z } from "zod";

import type { IsoDate } from "@/features/travel-explorer/types/travel.types";
import type { Coordinates } from "@/types/geo.types";

import { chunk } from "../lib/collections";
import { fetchJson, withQuery } from "../lib/http";

/**
 * Wikidata: structured facts with stable ids (`Q1058` is Narendra Modi). Used for who held an
 * office and when, photos, parties, and coordinates of places. Public domain (CC0).
 */

const SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";
const API_ENDPOINT = "https://www.wikidata.org/w/api.php";
const ENTITY_BATCH_SIZE = 50;
/**
 * English first, then "mul" (multiple languages): Wikidata now stores names spelled the same in
 * most languages, such as "Emmanuel Macron", under "mul" instead of repeating them per language.
 */
const LABEL_LANGUAGES = ["en", "mul"] as const;
const SEARCH_LIMIT = 5;

/** Wikidata time precision codes. */
const PRECISION_DAY = 11;
const PRECISION_MONTH = 10;
const TIME_PATTERN = /^[+-](\d{4,})-(\d{2})-(\d{2})/;
const ENTITY_ID_PATTERN = /Q\d+$/;
const POINT_PATTERN = /^Point\(([-\d.eE]+) ([-\d.eE]+)\)$/;

/** Property ids used across the pipeline. */
export const PROPERTY = {
    capital: "P36",
    citizenship: "P27",
    coordinates: "P625",
    country: "P17",
    endTime: "P582",
    image: "P18",
    instanceOf: "P31",
    isoAlpha3: "P298",
    party: "P102",
    positionHeld: "P39",
    startTime: "P580",
} as const;

export const HUMAN = "Q5";

// --- SPARQL -------------------------------------------------------------------------------

const sparqlResponseSchema = z.object({
    results: z.object({
        bindings: z.array(z.record(z.string(), z.object({ value: z.string() }))),
    }),
});

export type SparqlRow = Readonly<Record<string, string | undefined>>;

/**
 * Runs a SPARQL query and flattens each result row to plain strings.
 *
 * @param query - SPARQL query text.
 * @returns One record per row, keyed by variable name.
 */
export const runSparql = async (query: string): Promise<SparqlRow[]> => {
    const json = await fetchJson(SPARQL_ENDPOINT, {
        form: { format: "json", query },
        headers: { Accept: "application/sparql-results+json" },
    });
    return sparqlResponseSchema
        .parse(json)
        .results.bindings.map((row) =>
            Object.fromEntries(Object.entries(row).map(([key, cell]) => [key, cell.value]))
        );
};

/**
 * Extracts the item id from an entity URI.
 *
 * @param uri - e.g. `http://www.wikidata.org/entity/Q1058`.
 * @returns The id (`Q1058`), or `null` for anything else.
 */
export const entityId = (uri: string | undefined): string | null =>
    uri?.match(ENTITY_ID_PATTERN)?.[0] ?? null;

/**
 * Parses a WKT point literal returned by SPARQL.
 *
 * @param value - e.g. `Point(85.32 27.71)`.
 * @returns Longitude/latitude, or `null`.
 */
export const parsePoint = (value: string | undefined): Coordinates | null => {
    const match = value?.match(POINT_PATTERN);
    return match ? [Number(match[1]), Number(match[2])] : null;
};

// --- Entities -----------------------------------------------------------------------------

const snakSchema = z.object({
    datavalue: z.object({ value: z.unknown() }).optional(),
    snaktype: z.string(),
});

const claimSchema = z.object({
    mainsnak: snakSchema,
    qualifiers: z.record(z.string(), z.array(snakSchema)).optional(),
    rank: z.enum(["preferred", "normal", "deprecated"]),
});

const termSchema = z.object({ value: z.string() });

const entitySchema = z.object({
    aliases: z.record(z.string(), z.array(termSchema)).optional(),
    claims: z.record(z.string(), z.array(claimSchema)).optional(),
    descriptions: z.record(z.string(), termSchema).optional(),
    id: z.string(),
    labels: z.record(z.string(), termSchema).optional(),
    missing: z.string().optional(),
    sitelinks: z.record(z.string(), z.object({ title: z.string() })).optional(),
});

const entitiesResponseSchema = z.object({
    entities: z.record(z.string(), entitySchema),
});

type Snak = z.infer<typeof snakSchema>;
export type WikidataClaim = z.infer<typeof claimSchema>;

export interface WikidataEntity {
    aliases: readonly string[];
    claims: Readonly<Record<string, readonly WikidataClaim[]>>;
    description: string | null;
    /** Title of the English Wikipedia article, if there is one. */
    enwikiTitle: string | null;
    id: string;
    label: string | null;
}

const itemValueSchema = z.object({ id: z.string() });
const timeValueSchema = z.object({ precision: z.number(), time: z.string() });
const coordinateValueSchema = z.object({ latitude: z.number(), longitude: z.number() });

/**
 * Reads an item reference from a snak.
 *
 * @returns The referenced item id, or `null`.
 */
export const snakItem = (snak: Snak | undefined): string | null => {
    const parsed = itemValueSchema.safeParse(snak?.datavalue?.value);
    return parsed.success ? parsed.data.id : null;
};

/**
 * Reads a date from a snak, rounding month- and year-precision values to their first day.
 *
 * @returns The ISO date, or `null` for missing or unparseable values.
 */
export const snakDate = (snak: Snak | undefined): IsoDate | null => {
    const parsed = timeValueSchema.safeParse(snak?.datavalue?.value);
    const match = parsed.success ? parsed.data.time.match(TIME_PATTERN) : null;
    if (!(parsed.success && match)) {
        return null;
    }
    const month = parsed.data.precision >= PRECISION_MONTH ? match[2] : "01";
    const day = parsed.data.precision >= PRECISION_DAY ? match[3] : "01";
    return `${match[1].slice(-4)}-${month === "00" ? "01" : month}-${day === "00" ? "01" : day}`;
};

/**
 * Reads coordinates from a snak.
 *
 * @returns Longitude/latitude, or `null`.
 */
export const snakCoordinates = (snak: Snak | undefined): Coordinates | null => {
    const parsed = coordinateValueSchema.safeParse(snak?.datavalue?.value);
    return parsed.success ? [parsed.data.longitude, parsed.data.latitude] : null;
};

/**
 * Reads a plain string (e.g. an image file name) from a snak.
 *
 * @returns The string, or `null`.
 */
export const snakString = (snak: Snak | undefined): string | null => {
    const value = snak?.datavalue?.value;
    return typeof value === "string" ? value : null;
};

/**
 * Non-deprecated statements for a property, preferred ones first.
 *
 * @param entity - Entity to read.
 * @param property - Property id, e.g. `P39`.
 * @returns The statements.
 */
export const claimsOf = (entity: WikidataEntity, property: string): WikidataClaim[] =>
    (entity.claims[property] ?? [])
        .filter((claim) => claim.rank !== "deprecated")
        .sort((a, b) => Number(b.rank === "preferred") - Number(a.rank === "preferred"));

/**
 * First qualifier value of a statement.
 *
 * @param claim - Statement to read.
 * @param property - Qualifier property id.
 * @returns The qualifier snak, if present.
 */
export const qualifier = (claim: WikidataClaim, property: string): Snak | undefined =>
    claim.qualifiers?.[property]?.[0];

/**
 * Fetches entities by id, in batches of 50.
 *
 * @param ids - Item ids.
 * @param props - Which parts to load (fewer is faster).
 * @returns Entities keyed by id; missing items are left out.
 */
export const fetchEntities = async (
    ids: readonly string[],
    props: readonly ("aliases" | "claims" | "descriptions" | "labels" | "sitelinks")[]
): Promise<Map<string, WikidataEntity>> => {
    const entities = new Map<string, WikidataEntity>();
    const unique = [...new Set(ids)].sort();

    const responses = await Promise.all(
        chunk(unique, ENTITY_BATCH_SIZE).map((batch) =>
            fetchJson(
                withQuery(API_ENDPOINT, {
                    action: "wbgetentities",
                    format: "json",
                    ids: batch.join("|"),
                    languages: LABEL_LANGUAGES.join("|"),
                    props: props.join("|"),
                    sitefilter: "enwiki",
                })
            )
        )
    );
    for (const json of responses) {
        for (const raw of Object.values(entitiesResponseSchema.parse(json).entities)) {
            if (raw.missing !== undefined) {
                continue;
            }
            entities.set(raw.id, {
                aliases: LABEL_LANGUAGES.flatMap((language) =>
                    (raw.aliases?.[language] ?? []).map((alias) => alias.value)
                ),
                claims: raw.claims ?? {},
                description: raw.descriptions?.en?.value ?? null,
                enwikiTitle: raw.sitelinks?.enwiki?.title ?? null,
                id: raw.id,
                label: raw.labels?.en?.value ?? raw.labels?.mul?.value ?? null,
            });
        }
    }
    return entities;
};

// --- Search -------------------------------------------------------------------------------

/**
 * Finds a country's citizens whose name or alias is exactly one of the given spellings. One
 * query covers a whole cabinet, so this is the cheap first pass before per-name search.
 *
 * @param names - Exact spellings to look for.
 * @param countryId - Wikidata id of the country of citizenship.
 * @returns Matching person ids per spelling.
 */
export const findPeopleByExactName = async (
    names: readonly string[],
    countryId: string
): Promise<Map<string, string[]>> => {
    const matches = new Map<string, string[]>();
    if (names.length === 0) {
        return matches;
    }
    const values = names.flatMap((name) =>
        LABEL_LANGUAGES.map((language) => `${JSON.stringify(name)}@${language}`)
    );
    const rows = await runSparql(`
        SELECT DISTINCT ?name ?person WHERE {
            VALUES ?name { ${values.join(" ")} }
            ?person rdfs:label|skos:altLabel ?name .
            ?person wdt:${PROPERTY.instanceOf} wd:${HUMAN} ; wdt:${PROPERTY.citizenship} wd:${countryId} .
        }`);
    for (const row of rows) {
        const person = entityId(row.person);
        if (row.name && person) {
            matches.set(row.name, [...(matches.get(row.name) ?? []), person]);
        }
    }
    return matches;
};

const searchResponseSchema = z.object({
    query: z.object({
        search: z.array(z.object({ title: z.string() })),
    }),
});

/**
 * Finds people by name among a country's citizens.
 *
 * @param name - Name to search for.
 * @param countryId - Wikidata id of the country of citizenship.
 * @returns Candidate item ids, best match first.
 */
export const searchPeople = async (name: string, countryId: string): Promise<string[]> => {
    const json = await fetchJson(
        withQuery(API_ENDPOINT, {
            action: "query",
            format: "json",
            list: "search",
            srlimit: String(SEARCH_LIMIT),
            srsearch: `${name} haswbstatement:${PROPERTY.instanceOf}=${HUMAN} haswbstatement:${PROPERTY.citizenship}=${countryId}`,
        })
    );
    return searchResponseSchema.parse(json).query.search.map((result) => result.title);
};

/**
 * Public page of a Wikidata item.
 *
 * @param id - Item id.
 * @returns The item URL.
 */
export const wikidataUrl = (id: string): string => `https://www.wikidata.org/wiki/${id}`;

/**
 * Image URL for a Wikimedia Commons file, scaled down for avatars.
 *
 * @param fileName - Commons file name from an image statement.
 * @param width - Target width in pixels.
 * @returns A URL that redirects to the scaled image.
 */
export const commonsImageUrl = (fileName: string, width: number): string =>
    `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName.replaceAll(" ", "_"))}?width=${width}`;

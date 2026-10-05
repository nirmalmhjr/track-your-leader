import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";

import { z } from "zod";

import {
    generatedOfficialSchema,
    generatedTripSchema,
    placeSchema,
    sourceRefSchema,
} from "@/features/travel-explorer/data/generated-data.schema";
import {
    INDEX_VERSION,
    type OfficialRow,
    officialRow,
} from "@/features/travel-explorer/data/travel-index";
import type { CountryCode } from "@/types/geo.types";

import { PIPELINE_CONFIG } from "../config";
import { TRIP_SOURCES, type TripClaim, type TripSourceId } from "../types";
import { readJsonFile, serializeJson, writeJsonFile } from "./json-file";

/**
 * Everything the pipeline has collected, for every country and year:
 *
 * - `public/data/countries/<ISO3>.json` — each country's merged officials and trips. The app
 *   serves these files as they are and loads one when its country is opened.
 * - `data/warehouse/claims/<source>.json.gz` — each source's trips before merging, so a run
 *   that skips a slow source can reuse what it reported last time. Gzipped: large and
 *   machine-only.
 * - `data/warehouse/people/<ISO3>.json.gz` — everyone else politically exposed in the country
 *   (legislators, regional leaders, judges, diplomats… without trips), as compact official
 *   rows. Gzipped: hundreds of thousands of people. `pnpm data:people` unpacks them into
 *   `public/data/people/` for the app.
 * - `data/warehouse/report.json`, `meta.json` — what needs a look, and what is stored.
 */

const dir = (...parts: string[]): string => path.join(PIPELINE_CONFIG.warehouseDir, ...parts);
const countryFile = (code: CountryCode): string =>
    path.join(PIPELINE_CONFIG.countriesDir, `${code}.json`);
const ISO3_FILE = /^([A-Z]{3})\.json$/;

export const warehouseOfficialSchema = generatedOfficialSchema.extend({
    /** Other spellings of the name, for matching trips and for search. */
    aliases: z.array(z.string()),
});
export type WarehouseOfficial = z.infer<typeof warehouseOfficialSchema>;

const tripClaimSchema = z.object({
    datePrecision: z.enum(["day", "month", "year"]),
    destination: placeSchema,
    endDate: z.string(),
    engagements: z.array(z.string()),
    eventName: z.string().nullable(),
    purpose: z.string().nullable(),
    source: z.enum(TRIP_SOURCES),
    sourceRef: sourceRefSchema,
    startDate: z.string(),
    statusHint: z.enum(["cancelled", "planned"]).nullable(),
    traveller: z.object({
        categories: z.array(
            generatedOfficialSchema.shape.positions.element.shape.categories.element
        ),
        countryCode: z.string(),
        familyName: z.string().nullable(),
        name: z.string().nullable(),
        portfolio: generatedOfficialSchema.shape.positions.element.shape.portfolio,
        title: z.string().nullable(),
        wikidataId: z.string().nullable(),
    }),
    type: generatedTripSchema.shape.type,
});

export const countryFileSchema = z.object({
    officials: z.array(warehouseOfficialSchema),
    trips: z.array(generatedTripSchema),
});
export type CountryFile = z.infer<typeof countryFileSchema>;

/**
 * Countries that have a stored file.
 *
 * @returns Their codes, sorted.
 */
export const storedCountries = async (): Promise<CountryCode[]> => {
    try {
        const names = await readdir(PIPELINE_CONFIG.countriesDir);
        return names.flatMap((name) => name.match(ISO3_FILE)?.[1] ?? []).sort();
    } catch {
        return [];
    }
};

/**
 * Reads the stored files of the given countries (every stored country by default).
 *
 * @param codes - Countries to read.
 * @returns Officials and trips per country code; missing files are left out.
 */
export const readCountries = async (
    codes?: readonly CountryCode[]
): Promise<Map<CountryCode, CountryFile>> => {
    const wanted = codes ?? (await storedCountries());
    const files = await Promise.all(
        wanted.map((code) => readJsonFile(countryFile(code), countryFileSchema))
    );
    return new Map(
        wanted.flatMap((code, index) => {
            const file = files[index];
            return file ? [[code, file] as const] : [];
        })
    );
};

/**
 * Writes one country's officials and trips.
 *
 * @returns `true` when the file changed.
 */
export const writeCountry = (code: CountryCode, contents: CountryFile): Promise<boolean> =>
    writeJsonFile(countryFile(code), contents);

const claimsFile = (source: TripSourceId): string => dir("claims", `${source}.json.gz`);

/**
 * Reads the trips a source reported in an earlier run.
 *
 * @param source - Source id.
 * @returns Its claims, or an empty list when none are stored.
 */
export const readClaims = async (source: TripSourceId): Promise<TripClaim[]> => {
    try {
        const json: unknown = JSON.parse(gunzipSync(await readFile(claimsFile(source))).toString());
        return z.array(tripClaimSchema).parse(json);
    } catch {
        return [];
    }
};

const compareClaims = (a: TripClaim, b: TripClaim): number =>
    a.traveller.countryCode.localeCompare(b.traveller.countryCode) ||
    a.startDate.localeCompare(b.startDate) ||
    a.destination.countryCode.localeCompare(b.destination.countryCode) ||
    (a.traveller.name ?? "").localeCompare(b.traveller.name ?? "");

/**
 * Stores a source's claims, only rewriting the file when its contents change.
 *
 * @param source - Source id.
 * @param claims - Every claim the source currently reports.
 * @returns `true` when the file changed.
 */
export const writeClaims = async (
    source: TripSourceId,
    claims: readonly TripClaim[]
): Promise<boolean> => {
    const next = serializeJson([...claims].sort(compareClaims));
    const previous = await readFile(claimsFile(source))
        .then((buffer) => gunzipSync(buffer).toString())
        .catch(() => null);
    if (previous === next) {
        return false;
    }
    await mkdir(dir("claims"), { recursive: true });
    // Fixed mtime in the gzip header keeps identical contents byte-identical between runs.
    await writeFile(claimsFile(source), gzipSync(next, { level: 9 }));
    return true;
};

/**
 * Writes a JSON file at the warehouse root (report, meta).
 *
 * @param name - File name.
 * @param data - Contents.
 * @returns `true` when the file changed.
 */
export const writeWarehouseFile = (name: string, data: unknown): Promise<boolean> =>
    writeJsonFile(dir(name), data);

// --- People ---------------------------------------------------------------------------------

const peopleFile = (code: CountryCode): string => dir("people", `${code}.json.gz`);
const PEOPLE_FILE = /^([A-Z]{3})\.json\.gz$/;
const peopleSchema = z.object({ people: z.array(officialRow), version: z.literal(INDEX_VERSION) });

/** One person per line, so a weekly update diffs line by line once unpacked. */
export const serializePeople = (people: readonly OfficialRow[]): string =>
    `{"version":${INDEX_VERSION},"people":[\n${people.map((row) => JSON.stringify(row)).join(",\n")}\n]}\n`;

/**
 * Reads the people stored for every country.
 *
 * @returns Rows per country code.
 */
export const readAllPeople = async (): Promise<Map<CountryCode, OfficialRow[]>> => {
    const names = await readdir(dir("people")).catch(() => [] as string[]);
    const codes = names.flatMap((name) => name.match(PEOPLE_FILE)?.[1] ?? []).sort();
    const files = await Promise.all(
        codes.map(async (code) => {
            const text = gunzipSync(await readFile(peopleFile(code))).toString();
            return peopleSchema.parse(JSON.parse(text)).people;
        })
    );
    return new Map(codes.map((code, index) => [code, files[index]]));
};

/**
 * Stores a country's people, only rewriting the file when its contents change.
 *
 * @param code - Country.
 * @param people - Every person on record for it, sorted.
 * @returns `true` when the file changed.
 */
export const writePeople = async (
    code: CountryCode,
    people: readonly OfficialRow[]
): Promise<boolean> => {
    const next = serializePeople(people);
    const previous = await readFile(peopleFile(code))
        .then((buffer) => gunzipSync(buffer).toString())
        .catch(() => null);
    if (previous === next) {
        return false;
    }
    await mkdir(dir("people"), { recursive: true });
    await writeFile(peopleFile(code), gzipSync(next, { level: 9 }));
    return true;
};

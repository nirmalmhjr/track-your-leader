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
import type { CountryCode } from "@/types/geo.types";

import { PIPELINE_CONFIG } from "../config";
import { TRIP_SOURCES, type TripClaim, type TripSourceId } from "../types";
import { readJsonFile, serializeJson, writeJsonFile } from "./json-file";

/**
 * The warehouse keeps everything the pipeline has collected, for every country and year:
 *
 * - `officials/<ISO3>.json`, `trips/<ISO3>.json` — merged records per origin country,
 *   readable and diffable.
 * - `claims/<source>.json.gz` — each source's trips before merging, so a run that skips a
 *   slow source can reuse what it reported last time. Gzipped: they are large and
 *   machine-only.
 * - `report.json`, `meta.json` — what needs a look, and what the warehouse holds.
 */

const dir = (...parts: string[]): string => path.join(PIPELINE_CONFIG.warehouseDir, ...parts);
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

const countryFiles = async (folder: string): Promise<CountryCode[]> => {
    try {
        return (await readdir(dir(folder))).flatMap((name) => name.match(ISO3_FILE)?.[1] ?? []);
    } catch {
        return [];
    }
};

/**
 * Reads the stored officials of every country.
 *
 * @returns Officials per country code.
 */
export const readWarehouseOfficials = async (): Promise<Map<CountryCode, WarehouseOfficial[]>> => {
    const codes = await countryFiles("officials");
    const lists = await Promise.all(
        codes.map((code) =>
            readJsonFile(dir("officials", `${code}.json`), z.array(warehouseOfficialSchema))
        )
    );
    return new Map(codes.map((code, index) => [code, lists[index] ?? []]));
};

/**
 * Reads the stored trips of the given countries.
 *
 * @param codes - Origin countries.
 * @returns Trips per country code (empty when nothing is stored).
 */
export const readWarehouseTrips = async (
    codes: readonly CountryCode[]
): Promise<Map<CountryCode, z.infer<typeof generatedTripSchema>[]>> => {
    const lists = await Promise.all(
        codes.map((code) =>
            readJsonFile(dir("trips", `${code}.json`), z.array(generatedTripSchema))
        )
    );
    return new Map(codes.map((code, index) => [code, lists[index] ?? []]));
};

/**
 * Writes one country's officials and trips.
 *
 * @returns `true` when either file changed.
 */
export const writeCountry = async (
    code: CountryCode,
    officials: readonly WarehouseOfficial[],
    trips: readonly z.infer<typeof generatedTripSchema>[]
): Promise<boolean> => {
    const officialsChanged = await writeJsonFile(dir("officials", `${code}.json`), officials);
    const tripsChanged = await writeJsonFile(dir("trips", `${code}.json`), trips);
    return officialsChanged || tripsChanged;
};

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

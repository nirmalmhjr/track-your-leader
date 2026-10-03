import { z } from "zod";

import {
    PORTFOLIOS,
    ROLE_CATEGORIES,
    TRAVEL_TYPES,
} from "@/features/travel-explorer/constants/explorer.constants";

/**
 * Shape of the files in `generated/`, written by `scripts/data-pipeline` and read by the app.
 * Both sides validate against these schemas, so a pipeline bug can never ship malformed data.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_ALPHA3 = /^[A-Z]{3}$/;
const WIKIDATA_ID = /^Q\d+$/;

const isoDate = z.string().regex(ISO_DATE);
const countryCode = z.string().regex(ISO_ALPHA3);

const sourceRefSchema = z.object({
    label: z.string().min(1),
    url: z.url(),
});

const placeSchema = z.object({
    city: z.string().min(1),
    coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]).readonly(),
    countryCode,
    region: z.enum(["Africa", "Americas", "Antarctic", "Asia", "Europe", "Oceania"]),
});

const positionSchema = z.object({
    categories: z.array(z.enum(ROLE_CATEGORIES)).min(1),
    endDate: isoDate.nullable(),
    id: z.string().min(1),
    ministry: z.string().nullable(),
    portfolio: z.enum(PORTFOLIOS).nullable(),
    startDate: isoDate.nullable(),
    title: z.string().min(1),
});

export const generatedOfficialSchema = z.object({
    countryCode,
    fullName: z.string().min(1),
    id: z.string().min(1),
    party: z.string().nullable(),
    photoUrl: z.url().nullable(),
    positions: z.array(positionSchema).min(1),
    sources: z.array(sourceRefSchema),
    summary: z.string(),
    wikidataId: z.string().regex(WIKIDATA_ID).nullable(),
});

/**
 * A trip as stored on disk. Status, origin and the traveller's title are derived when the
 * dataset is built, so they always reflect today's date and the latest office records.
 */
export const generatedTripSchema = z.object({
    datePrecision: z.enum(["day", "month", "year"]),
    destination: placeSchema,
    endDate: isoDate,
    engagements: z.array(z.string()),
    eventName: z.string().nullable(),
    id: z.string().min(1),
    officialId: z.string().min(1),
    purpose: z.string().min(1),
    sources: z.array(sourceRefSchema).min(1),
    startDate: isoDate,
    statusHint: z.enum(["cancelled", "planned"]).nullable(),
    type: z.enum(TRAVEL_TYPES),
});

export const generatedOfficialsSchema = z.array(generatedOfficialSchema);
export const generatedTripsSchema = z.array(generatedTripSchema);

/** Summary of the last run that changed the data. */
export const generatedMetaSchema = z.object({
    /** Per country: date of the cabinet list used, and whether it was usable. */
    cabinets: z.record(z.string(), z.object({ asOf: isoDate.nullable(), status: z.string() })),
    counts: z.object({ officials: z.number(), trips: z.number() }),
    sinceYear: z.number(),
    updatedOn: isoDate,
});

export type GeneratedOfficial = z.infer<typeof generatedOfficialSchema>;
export type GeneratedTrip = z.infer<typeof generatedTripSchema>;

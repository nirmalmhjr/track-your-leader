import { z } from "zod";

import {
    PORTFOLIOS,
    ROLE_CATEGORIES,
    TRAVEL_TYPES,
} from "@/features/travel-explorer/constants/explorer.constants";
import type {
    DatePrecision,
    IsoDate,
    Official,
    Place,
    TrackedCountry,
    TravelRecord,
} from "@/features/travel-explorer/types/travel.types";
import { resolvePositionTitle } from "@/features/travel-explorer/utils/positions.utils";
import { resolveTravelStatus } from "@/features/travel-explorer/utils/travel-status.utils";
import { getCountryReference, getCountryRegion } from "@/lib/geo/country-reference";
import type { CountryCode } from "@/types/geo.types";

import {
    type GeneratedOfficial,
    type GeneratedTrip,
    generatedOfficialSchema,
    generatedTripSchema,
} from "./generated-data.schema";

/**
 * The explorer's data as served from `public/data/`, written by `scripts/data-pipeline`:
 *
 * - `index.json` — every country, official and trip, compact: arrays instead of objects, and
 *   enums and repeated places as numbers. Enough for the map, search, filters and lists.
 * - `countries/<ISO3>.json` — one country's full records (biographies, trip purposes,
 *   engagements, sources), loaded when that country is opened.
 */

export const DATA_BASE_PATH = "/data";
export const INDEX_VERSION = 1;

/** Position in these lists is the number stored in the index. */
const DATE_PRECISIONS = ["day", "month", "year"] as const satisfies readonly DatePrecision[];
const STATUS_HINTS = [null, "cancelled", "planned"] as const;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const code = z.string().regex(/^[A-Z]{3}$/);
const longitude = z.number().min(-180).max(180);
const latitude = z.number().min(-90).max(90);
const enumIndex = (values: readonly unknown[]) =>
    z
        .number()
        .int()
        .min(0)
        .max(values.length - 1);

/** [country, capital, longitude, latitude, government system] */
const countryRow = z.tuple([code, z.string(), longitude, latitude, z.string().nullable()]);
/** [country, city, longitude, latitude, 1 when only the country is known] */
const placeRow = z.tuple([
    code,
    z.string(),
    longitude,
    latitude,
    z.union([z.literal(0), z.literal(1)]),
]);
/** [title, categories, portfolio, start, end] */
const positionRow = z.tuple([
    z.string(),
    z.array(enumIndex(ROLE_CATEGORIES)).min(1),
    enumIndex(PORTFOLIOS).nullable(),
    isoDate.nullable(),
    isoDate.nullable(),
]);
/** [id, country, name, party, photo, Wikidata id, positions] */
const officialRow = z.tuple([
    z.string(),
    code,
    z.string(),
    z.string().nullable(),
    z.string().nullable(),
    z.string().nullable(),
    z.array(positionRow).min(1),
]);
/** [official, place, start, end, date precision, type, status hint, id when not the default] */
const tripRow = z.union([
    z.tuple([
        z.number().int(),
        z.number().int(),
        isoDate,
        isoDate,
        enumIndex(DATE_PRECISIONS),
        enumIndex(TRAVEL_TYPES),
        enumIndex(STATUS_HINTS),
    ]),
    z.tuple([
        z.number().int(),
        z.number().int(),
        isoDate,
        isoDate,
        enumIndex(DATE_PRECISIONS),
        enumIndex(TRAVEL_TYPES),
        enumIndex(STATUS_HINTS),
        z.string(),
    ]),
]);

export const travelIndexSchema = z.object({
    countries: z.array(countryRow),
    officials: z.array(officialRow),
    places: z.array(placeRow),
    trips: z.array(tripRow),
    updatedOn: isoDate,
    version: z.literal(INDEX_VERSION),
});
export type TravelIndex = z.infer<typeof travelIndexSchema>;

export const countryDetailSchema = z.object({
    officials: z.array(generatedOfficialSchema),
    trips: z.array(generatedTripSchema),
});
export type CountryDetail = z.infer<typeof countryDetailSchema>;

/** Default trip id; the index only stores ids that differ from it. */
export const defaultTripId = (
    officialId: string,
    startDate: IsoDate,
    destination: CountryCode
): string => `${officialId}--${startDate}--${destination}`;

// --- Writing (pipeline) -------------------------------------------------------------------------

export interface IndexInput {
    countries: readonly TrackedCountry[];
    officials: readonly GeneratedOfficial[];
    trips: readonly GeneratedTrip[];
    updatedOn: IsoDate;
}

const round = (value: number): number => Math.round(value * 1000) / 1000;

/**
 * Encodes officials and trips as the compact index.
 *
 * @param input - Countries, officials and trips to include.
 * @returns The index, ready to serialise.
 */
export const encodeTravelIndex = ({
    countries,
    officials,
    trips,
    updatedOn,
}: IndexInput): TravelIndex => {
    const officialIndex = new Map(officials.map((official, index) => [official.id, index]));
    const places: TravelIndex["places"] = [];
    const placeIndex = new Map<string, number>();
    const placeOf = (place: Place): number => {
        const isCountry = place.precision === "country" ? 1 : 0;
        const key = `${place.countryCode}|${place.city}|${isCountry}`;
        let index = placeIndex.get(key);
        if (index === undefined) {
            index = places.length;
            places.push([
                place.countryCode,
                place.city,
                round(place.coordinates[0]),
                round(place.coordinates[1]),
                isCountry,
            ]);
            placeIndex.set(key, index);
        }
        return index;
    };

    return {
        countries: countries.map((country) => [
            country.code,
            country.capital.city,
            round(country.capital.coordinates[0]),
            round(country.capital.coordinates[1]),
            country.governmentSystem,
        ]),
        officials: officials.map((official) => [
            official.id,
            official.countryCode,
            official.fullName,
            official.party,
            official.photoUrl,
            official.wikidataId,
            official.positions.map((position) => [
                position.title,
                position.categories.map((category) => ROLE_CATEGORIES.indexOf(category)),
                position.portfolio ? PORTFOLIOS.indexOf(position.portfolio) : null,
                position.startDate,
                position.endDate,
            ]),
        ]),
        places,
        trips: trips.flatMap((trip): TravelIndex["trips"] => {
            const official = officialIndex.get(trip.officialId);
            if (official === undefined) {
                return [];
            }
            const row = [
                official,
                placeOf(trip.destination),
                trip.startDate,
                trip.endDate,
                DATE_PRECISIONS.indexOf(trip.datePrecision),
                TRAVEL_TYPES.indexOf(trip.type),
                STATUS_HINTS.indexOf(trip.statusHint),
            ] as const;
            const isDefaultId =
                trip.id ===
                defaultTripId(trip.officialId, trip.startDate, trip.destination.countryCode);
            return [isDefaultId ? [...row] : [...row, trip.id]];
        }),
        updatedOn,
        version: INDEX_VERSION,
    };
};

/**
 * Serialises the index with one record per line, so daily updates diff line by line in git.
 *
 * @param index - Encoded index.
 * @returns File contents.
 */
export const serializeTravelIndex = (index: TravelIndex): string => {
    const lines = (rows: readonly unknown[]): string =>
        rows.map((row) => JSON.stringify(row)).join(",\n");
    return [
        "{",
        `"version":${index.version},"updatedOn":${JSON.stringify(index.updatedOn)},`,
        `"countries":[\n${lines(index.countries)}\n],`,
        `"places":[\n${lines(index.places)}\n],`,
        `"officials":[\n${lines(index.officials)}\n],`,
        `"trips":[\n${lines(index.trips)}\n]`,
        "}\n",
    ].join("\n");
};

// --- Reading (app) ------------------------------------------------------------------------------

export interface TravelBase {
    countries: TrackedCountry[];
    officials: Official[];
    /** Trips grouped by the traveller's country, so a country's detail can replace its group. */
    recordsByOrigin: Map<CountryCode, TravelRecord[]>;
    updatedOn: IsoDate;
}

const toPlace = ([
    countryCode,
    city,
    lon,
    lat,
    isCountry,
]: TravelIndex["places"][number]): Place => ({
    city,
    coordinates: [lon, lat],
    countryCode,
    region: getCountryRegion(countryCode),
    ...(isCountry ? { precision: "country" as const } : {}),
});

const toCountry = ([
    countryCode,
    city,
    lon,
    lat,
    governmentSystem,
]: TravelIndex["countries"][number]): TrackedCountry => ({
    capital: { city, coordinates: [lon, lat], countryCode, region: getCountryRegion(countryCode) },
    code: countryCode,
    governmentSystem,
    name: getCountryReference(countryCode)?.name ?? countryCode,
});

const toOfficial = ([
    id,
    countryCode,
    fullName,
    party,
    photoUrl,
    wikidataId,
    positions,
]: TravelIndex["officials"][number]): Official => ({
    countryCode,
    fullName,
    id,
    party,
    photoUrl,
    positions: positions.map(([title, categories, portfolio, startDate, endDate], index) => ({
        categories: categories.map((category) => ROLE_CATEGORIES[category]),
        endDate,
        id: `${id}-p${index + 1}`,
        ministry: null,
        portfolio: portfolio === null ? null : PORTFOLIOS[portfolio],
        startDate,
        title,
    })),
    sources: [],
    summary: "",
    wikidataId,
});

interface RecordInput {
    countryByCode: ReadonlyMap<CountryCode, TrackedCountry>;
    official: Official;
    today: IsoDate;
}

/**
 * Builds the app's record of a trip, deriving status, origin and the traveller's title.
 *
 * @returns The record, or `null` when the traveller's country is unknown.
 */
export const toTravelRecord = (
    { statusHint, ...trip }: GeneratedTrip,
    { countryByCode, official, today }: RecordInput
): TravelRecord | null => {
    const country = countryByCode.get(official.countryCode);
    if (!country) {
        return null;
    }
    return {
        ...trip,
        origin: country.capital,
        originCountryCode: country.code,
        positionTitle: resolvePositionTitle(official, trip.startDate),
        status: resolveTravelStatus({
            datePrecision: trip.datePrecision,
            endDate: trip.endDate,
            hint: statusHint,
            today,
        }),
    };
};

/**
 * Decodes the index into countries, officials and trips. Trips carry no purpose, engagements
 * or sources until their country's detail is loaded.
 *
 * @param index - Validated index.
 * @param today - Reference date for statuses.
 * @returns The decoded base dataset.
 */
export const decodeTravelIndex = (index: TravelIndex, today: IsoDate): TravelBase => {
    const countries = index.countries.map(toCountry);
    const countryByCode = new Map(countries.map((country) => [country.code, country]));
    const officials = index.officials.map(toOfficial);
    const places = index.places.map(toPlace);
    const recordsByOrigin = new Map<CountryCode, TravelRecord[]>();

    for (const [
        officialIndex,
        placeIndex,
        startDate,
        endDate,
        precision,
        type,
        status,
        id,
    ] of index.trips) {
        const official = officials[officialIndex];
        const destination = places[placeIndex];
        if (!(official && destination)) {
            continue;
        }
        const record = toTravelRecord(
            {
                datePrecision: DATE_PRECISIONS[precision],
                destination,
                endDate,
                engagements: [],
                eventName: null,
                id: id ?? defaultTripId(official.id, startDate, destination.countryCode),
                officialId: official.id,
                purpose: "",
                sources: [],
                startDate,
                statusHint: STATUS_HINTS[status],
                type: TRAVEL_TYPES[type],
            },
            { countryByCode, official, today }
        );
        if (record) {
            const group = recordsByOrigin.get(record.originCountryCode);
            if (group) {
                group.push(record);
            } else {
                recordsByOrigin.set(record.originCountryCode, [record]);
            }
        }
    }
    return { countries, officials, recordsByOrigin, updatedOn: index.updatedOn };
};

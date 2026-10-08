import { toSearchPerson } from "@/lib/travel/search.utils";
import type { CountryCode } from "@/types/geo.types";
import type {
    IsoDate,
    Official,
    SearchPerson,
    TrackedCountry,
    TravelRecord,
} from "@/types/travel.types";

import { buildSampleTravelDataset } from "./sample/sample-dataset";
import {
    countryDetailSchema,
    DATA_BASE_PATH,
    decodeOfficial,
    decodeSearchIndex,
    decodeTravelIndex,
    peopleFileSchema,
    searchIndexSchema,
    type TravelBase,
    toTravelRecord,
    travelIndexSchema,
} from "./travel-index";

/**
 * Loads the explorer's data from the files the pipeline publishes in `public/data/`. Before the
 * pipeline has run (a fresh checkout without `index.json`), the fictional samples are shown.
 */

const HTTP_NOT_FOUND = 404;

export type TravelDataSource = "generated" | "sample";

export interface LoadedTravelBase {
    base: TravelBase;
    source: TravelDataSource;
    /** Day the pipeline last changed the data, or `null` for the samples. */
    updatedOn: IsoDate | null;
}

const groupByOrigin = (records: readonly TravelRecord[]): Map<CountryCode, TravelRecord[]> => {
    const groups = new Map<CountryCode, TravelRecord[]>();
    for (const record of records) {
        const group = groups.get(record.originCountryCode);
        if (group) {
            group.push(record);
        } else {
            groups.set(record.originCountryCode, [record]);
        }
    }
    return groups;
};

/** The fictional samples, shown before the pipeline has published any data. */
export const sampleBase = (today: IsoDate): LoadedTravelBase => {
    const dataset = buildSampleTravelDataset(today);
    return {
        base: {
            countries: [...dataset.countries],
            officials: [...dataset.officials],
            recordsByOrigin: groupByOrigin(dataset.records),
            updatedOn: today,
        },
        source: "sample",
        updatedOn: null,
    };
};

/**
 * Loads every country, official and trip in compact form.
 *
 * @param today - Reference date for trip statuses.
 * @param signal - Aborts the request.
 * @returns The decoded base dataset and where it came from.
 * @throws When the file exists but can't be read or doesn't match the expected format.
 */
export const loadTravelBase = async (
    today: IsoDate,
    signal?: AbortSignal
): Promise<LoadedTravelBase> => {
    const response = await fetch(`${DATA_BASE_PATH}/index.json`, { signal });
    if (response.status === HTTP_NOT_FOUND) {
        return sampleBase(today);
    }
    if (!response.ok) {
        throw new Error(`Travel data unavailable (HTTP ${response.status})`);
    }
    const index = travelIndexSchema.parse(await response.json());
    return {
        base: decodeTravelIndex(index, today),
        source: "generated",
        updatedOn: index.updatedOn,
    };
};

export interface LoadedCountryDetail {
    officials: Official[];
    records: TravelRecord[];
}

/**
 * Validates and decodes one country's detail file.
 *
 * @param raw - Parsed JSON of `countries/<ISO3>.json`.
 * @param countryByCode - Countries from the base dataset (trip origins).
 * @param today - Reference date for trip statuses.
 * @returns The country's officials and trips.
 * @throws When the file doesn't match the expected format.
 */
export const decodeCountryDetail = (
    raw: unknown,
    countryByCode: ReadonlyMap<CountryCode, TrackedCountry>,
    today: IsoDate
): LoadedCountryDetail => {
    const detail = countryDetailSchema.parse(raw);
    const officialById = new Map(detail.officials.map((official) => [official.id, official]));
    const records = detail.trips.flatMap((trip) => {
        const official = officialById.get(trip.officialId);
        const record = official ? toTravelRecord(trip, { countryByCode, official, today }) : null;
        return record ? [record] : [];
    });
    return { officials: detail.officials, records };
};

/**
 * Loads one country's full records: biographies, sources, trip purposes and engagements.
 *
 * @param code - Country code.
 * @param countryByCode - Countries from the base dataset (trip origins).
 * @param today - Reference date for trip statuses.
 * @param signal - Aborts the request.
 * @returns The country's officials and trips.
 */
export const loadCountryDetail = async (
    code: CountryCode,
    countryByCode: ReadonlyMap<CountryCode, TrackedCountry>,
    today: IsoDate,
    signal?: AbortSignal
): Promise<LoadedCountryDetail> => {
    const response = await fetch(`${DATA_BASE_PATH}/countries/${code}.json`, { signal });
    if (!response.ok) {
        throw new Error(`Details for ${code} unavailable (HTTP ${response.status})`);
    }
    return decodeCountryDetail(await response.json(), countryByCode, today);
};

/**
 * Decodes a people file into officials, each linked to their Wikidata record.
 *
 * @param raw - Parsed `public/data/people/<ISO3>.json`.
 * @returns Everyone on record for the country beyond the officials in its country file.
 * @throws When the file doesn't match the expected format.
 */
export const decodePeople = (raw: unknown): Official[] =>
    peopleFileSchema.parse(raw).people.map((row) => {
        const official = decodeOfficial(row);
        return official.wikidataId
            ? {
                  ...official,
                  sources: [
                      {
                          label: "Wikidata",
                          url: `https://www.wikidata.org/wiki/${official.wikidataId}`,
                      },
                  ],
              }
            : official;
    });

/**
 * Loads everyone else on record for a country: legislators, regional and city leaders, judges,
 * diplomats and others without trips.
 *
 * @param code - Country code.
 * @param signal - Aborts the request.
 * @returns The people, or none when the country has no people file.
 */
export const loadCountryPeople = async (
    code: CountryCode,
    signal?: AbortSignal
): Promise<Official[]> => {
    const response = await fetch(`${DATA_BASE_PATH}/people/${code}.json`, { signal });
    if (response.status === HTTP_NOT_FOUND) {
        return [];
    }
    if (!response.ok) {
        throw new Error(`People of ${code} unavailable (HTTP ${response.status})`);
    }
    return decodePeople(await response.json());
};

/**
 * The header search's people, taken from the full index when the search file hasn't been built.
 *
 * @param base - The decoded index.
 * @returns Everyone in the index, with their trip counts.
 */
const searchPeopleFromBase = ({ officials, recordsByOrigin }: TravelBase): SearchPerson[] => {
    const tripCounts = new Map<string, number>();
    for (const records of recordsByOrigin.values()) {
        for (const record of records) {
            tripCounts.set(record.officialId, (tripCounts.get(record.officialId) ?? 0) + 1);
        }
    }
    return officials.map((official) => toSearchPerson(official, tripCounts.get(official.id) ?? 0));
};

/**
 * Loads everyone the header search lists. Before `pnpm data:search` has run (in development),
 * or with the samples, they are taken from the full index instead.
 *
 * @param today - Reference date for trip statuses, used only when reading the full index.
 * @param signal - Aborts the request.
 * @returns The people, each with a title and trip count.
 * @throws When the file exists but can't be read or doesn't match the expected format.
 */
export const loadSearchPeople = async (
    today: IsoDate,
    signal?: AbortSignal
): Promise<SearchPerson[]> => {
    const response = await fetch(`${DATA_BASE_PATH}/search.json`, { signal });
    if (response.status === HTTP_NOT_FOUND) {
        return searchPeopleFromBase((await loadTravelBase(today, signal)).base);
    }
    if (!response.ok) {
        throw new Error(`Search data unavailable (HTTP ${response.status})`);
    }
    return decodeSearchIndex(searchIndexSchema.parse(await response.json()));
};

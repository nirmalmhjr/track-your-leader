import type {
    IsoDate,
    Official,
    TrackedCountry,
    TravelRecord,
} from "@/features/travel-explorer/types/travel.types";
import type { CountryCode } from "@/types/geo.types";

import { buildSampleTravelDataset } from "./sample/sample-dataset";
import {
    countryDetailSchema,
    DATA_BASE_PATH,
    decodeTravelIndex,
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

const sampleBase = (today: IsoDate): LoadedTravelBase => {
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
    const detail = countryDetailSchema.parse(await response.json());
    const officialById = new Map(detail.officials.map((official) => [official.id, official]));
    const records = detail.trips.flatMap((trip) => {
        const official = officialById.get(trip.officialId);
        const record = official ? toTravelRecord(trip, { countryByCode, official, today }) : null;
        return record ? [record] : [];
    });
    return { officials: detail.officials, records };
};

import type { CountryCode } from "@/types/geo.types";
import type { IsoDate, TrackedCountry } from "@/types/travel.types";

import {
    type LoadedCountryDetail,
    type LoadedTravelBase,
    loadCountryDetail,
    loadTravelBase,
} from "./travel-dataset";

/**
 * Where the explorer gets its data. Today it reads the static files the pipeline publishes in
 * `public/data/`; a client for a database-backed API (see `docs/mongodb-api.md`) can replace it
 * by implementing the same methods, without touching the components.
 */
export interface TravelDataClient {
    /** One country's full records: biographies, sources, trip purposes and engagements. */
    getCountry: (
        code: CountryCode,
        countryByCode: ReadonlyMap<CountryCode, TrackedCountry>,
        today: IsoDate,
        signal?: AbortSignal
    ) => Promise<LoadedCountryDetail>;
    /** Every country, official and trip, compact: enough for the map, search and lists. */
    getIndex: (today: IsoDate, signal?: AbortSignal) => Promise<LoadedTravelBase>;
}

/** Reads `public/data/index.json` and `public/data/countries/<ISO3>.json`. */
export const staticFileClient: TravelDataClient = {
    getCountry: loadCountryDetail,
    getIndex: loadTravelBase,
};

/** The client the app uses. */
export const travelDataClient: TravelDataClient = staticFileClient;

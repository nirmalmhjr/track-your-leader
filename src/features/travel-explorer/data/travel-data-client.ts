import type { CountryCode } from "@/types/geo.types";
import type { IsoDate, Official, SearchPerson, TrackedCountry } from "@/types/travel.types";

import {
    type LoadedCountryDetail,
    type LoadedTravelBase,
    loadCountryDetail,
    loadCountryPeople,
    loadSearchPeople,
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
    /** Everyone else on record for a country (legislators, judges…), who has no trips. */
    getPeople: (code: CountryCode, signal?: AbortSignal) => Promise<Official[]>;
    /** Everyone the header search lists, without their trips. */
    getSearchPeople: (today: IsoDate, signal?: AbortSignal) => Promise<SearchPerson[]>;
}

/** Reads `public/data/index.json`, `search.json`, `countries/<ISO3>.json` and `people/<ISO3>.json`. */
export const staticFileClient: TravelDataClient = {
    getCountry: loadCountryDetail,
    getIndex: loadTravelBase,
    getPeople: loadCountryPeople,
    getSearchPeople: loadSearchPeople,
};

/** The client the app uses. */
export const travelDataClient: TravelDataClient = staticFileClient;

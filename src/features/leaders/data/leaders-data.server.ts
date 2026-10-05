import "server-only";

import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { cache } from "react";

import { buildCountryNames } from "@/features/leaders/data/country-names.server";
import type {
    CountryDirectory,
    CountryListItem,
    DirectoryContext,
    DirectoryOverview,
    OfficialProfile,
} from "@/features/leaders/types/leaders.types";
import {
    buildCountryDirectory,
    buildCountryList,
    buildOverview,
    compareNewestFirst,
    groupRecordsByOfficial,
    sortCountriesByName,
} from "@/features/leaders/utils/leaders.utils";
import {
    decodeCountryDetail,
    type LoadedCountryDetail,
    type LoadedTravelBase,
    sampleBase,
} from "@/features/travel-explorer/data/travel-dataset";
import { decodeTravelIndex, travelIndexSchema } from "@/features/travel-explorer/data/travel-index";
import type { IsoDate, TravelRecord } from "@/features/travel-explorer/types/travel.types";
import { toIsoDate } from "@/features/travel-explorer/utils/date.utils";
import type { CountryCode } from "@/types/geo.types";

/**
 * What the leaders pages read. Today it is backed by the files the pipeline publishes in
 * `public/data/`; a database-backed implementation can replace it without touching the pages.
 */
export interface LeadersDataSource {
    getContext: () => Promise<DirectoryContext>;
    getCountryDirectory: (code: CountryCode) => Promise<CountryDirectory | null>;
    /** Every tracked country, alphabetical in the given locale. */
    getCountryList: (locale: string) => Promise<CountryListItem[]>;
    getOfficialProfile: (code: CountryCode, officialId: string) => Promise<OfficialProfile | null>;
    getOverview: () => Promise<DirectoryOverview>;
}

const DATA_DIRECTORY = path.join(process.cwd(), "public", "data");
/** Country files kept parsed in memory; the largest are a few megabytes each. */
const DETAIL_CACHE_LIMIT = 24;

interface DerivedBase {
    countryList: CountryListItem[];
    loaded: LoadedTravelBase;
    overview: DirectoryOverview;
    recordsByOfficial: Map<string, TravelRecord[]>;
}

interface CacheEntry<T> {
    key: string;
    value: Promise<T>;
}

let baseEntry: CacheEntry<DerivedBase> | null = null;
const detailEntries = new Map<CountryCode, CacheEntry<LoadedCountryDetail | null>>();

const isMissingFile = (error: unknown): boolean =>
    error instanceof Error && "code" in error && error.code === "ENOENT";

/** Modification time of a data file, or `null` when the pipeline hasn't written it. */
const readModifiedTime = async (file: string): Promise<number | null> => {
    try {
        return (await stat(file)).mtimeMs;
    } catch (error) {
        if (isMissingFile(error)) {
            return null;
        }
        throw error;
    }
};

const readJson = async (file: string): Promise<unknown> => JSON.parse(await readFile(file, "utf8"));

const deriveBase = (loaded: LoadedTravelBase, today: IsoDate): DerivedBase => {
    const recordsByOfficial = groupRecordsByOfficial(loaded.base);
    return {
        countryList: buildCountryList(loaded.base),
        loaded,
        overview: buildOverview(loaded.base, recordsByOfficial, today),
        recordsByOfficial,
    };
};

/**
 * The decoded index, parsed once per data update and day: trip statuses depend on today.
 * Falls back to the fictional samples before the pipeline has run, like the explorer.
 */
const loadBase = async (today: IsoDate): Promise<DerivedBase> => {
    const file = path.join(DATA_DIRECTORY, "index.json");
    const modified = await readModifiedTime(file);
    const key = `${modified ?? "sample"}|${today}`;
    if (baseEntry?.key === key) {
        return baseEntry.value;
    }

    const value = (async () => {
        if (modified === null) {
            return deriveBase(sampleBase(today), today);
        }
        const index = travelIndexSchema.parse(await readJson(file));
        return deriveBase(
            {
                base: decodeTravelIndex(index, today),
                source: "generated",
                updatedOn: index.updatedOn,
            },
            today
        );
    })();
    baseEntry = { key, value };
    // A failed read must not stick: the next request tries again.
    value.catch(() => {
        if (baseEntry?.value === value) {
            baseEntry = null;
        }
    });
    return value;
};

/** One country's full records, or `null` when there is no detail file (e.g. sample data). */
const loadDetail = async (
    code: CountryCode,
    derived: DerivedBase,
    today: IsoDate
): Promise<LoadedCountryDetail | null> => {
    const file = path.join(DATA_DIRECTORY, "countries", `${code}.json`);
    const modified = await readModifiedTime(file);
    if (modified === null) {
        return null;
    }
    const key = `${modified}|${today}`;
    const cached = detailEntries.get(code);
    if (cached?.key === key) {
        // Re-inserting keeps the most recently used countries at the end.
        detailEntries.delete(code);
        detailEntries.set(code, cached);
        return cached.value;
    }

    const countryByCode = new Map(
        derived.loaded.base.countries.map((country) => [country.code, country])
    );
    const value = readJson(file).then((raw) => decodeCountryDetail(raw, countryByCode, today));
    detailEntries.delete(code);
    detailEntries.set(code, { key, value });
    if (detailEntries.size > DETAIL_CACHE_LIMIT) {
        const oldest = detailEntries.keys().next().value;
        if (oldest) {
            detailEntries.delete(oldest);
        }
    }
    value.catch(() => {
        if (detailEntries.get(code)?.value === value) {
            detailEntries.delete(code);
        }
    });
    return value;
};

/** Today's date, fixed for the whole request so every part of a page agrees. */
const getToday = cache((): IsoDate => toIsoDate(new Date()));

const getBase = cache(() => loadBase(getToday()));

const getContext = cache(async (): Promise<DirectoryContext> => {
    const { loaded } = await getBase();
    return { today: getToday(), updatedOn: loaded.updatedOn };
});

const getCountryList = cache(async (locale: string) =>
    sortCountriesByName((await getBase()).countryList, buildCountryNames(locale), locale)
);

const getOverview = cache(async () => (await getBase()).overview);

const getCountryDirectory = cache(async (code: CountryCode) => {
    const derived = await getBase();
    return buildCountryDirectory(derived.loaded.base, code, derived.recordsByOfficial);
});

const getOfficialProfile = cache(
    async (code: CountryCode, officialId: string): Promise<OfficialProfile | null> => {
        const derived = await getBase();
        const { base } = derived.loaded;
        const country = base.countries.find((candidate) => candidate.code === code);
        const compact = base.officials.find(
            (candidate) => candidate.id === officialId && candidate.countryCode === code
        );
        if (!(country && compact)) {
            return null;
        }

        // The index lacks biographies, sources and trip purposes; the country file has them.
        const detail = await loadDetail(code, derived, getToday());
        const official =
            detail?.officials.find((candidate) => candidate.id === officialId) ?? compact;
        const records = (
            detail?.records.filter((record) => record.officialId === officialId) ??
            derived.recordsByOfficial.get(officialId) ??
            []
        ).toSorted(compareNewestFirst);

        return { country, official, records };
    }
);

export const leadersData: LeadersDataSource = {
    getContext,
    getCountryDirectory,
    getCountryList,
    getOfficialProfile,
    getOverview,
};

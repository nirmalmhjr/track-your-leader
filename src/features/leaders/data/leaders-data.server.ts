import "server-only";

import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { cache } from "react";

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
    decodePeople,
    type LoadedCountryDetail,
    type LoadedTravelBase,
    sampleBase,
} from "@/features/travel-explorer/data/travel-dataset";
import { decodeTravelIndex, travelIndexSchema } from "@/features/travel-explorer/data/travel-index";
import { buildCountryNames } from "@/lib/travel/country-names.server";
import { toIsoDate } from "@/lib/travel/date.utils";
import type { CountryCode } from "@/types/geo.types";
import type { IsoDate, Official, TravelRecord } from "@/types/travel.types";

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
    /** Whether the official (or person) is on record for the country. */
    hasOfficial: (code: CountryCode, officialId: string) => Promise<boolean>;
}

const DATA_DIRECTORY = path.join(process.cwd(), "public", "data");
/** Country files kept parsed in memory; the largest are a few megabytes each. */
const DETAIL_CACHE_LIMIT = 24;
/** People files kept parsed in memory; the largest hold tens of thousands of people. */
const PEOPLE_CACHE_LIMIT = 8;

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
const peopleEntries = new Map<CountryCode, CacheEntry<Map<string, Official>>>();

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

/**
 * Everyone else on record for a country (legislators, judges… without trips), by id. Empty
 * when the country has no people file.
 */
const loadPeople = async (code: CountryCode): Promise<Map<string, Official>> => {
    const file = path.join(DATA_DIRECTORY, "people", `${code}.json`);
    const modified = await readModifiedTime(file);
    if (modified === null) {
        return new Map();
    }
    const key = String(modified);
    const cached = peopleEntries.get(code);
    if (cached?.key === key) {
        peopleEntries.delete(code);
        peopleEntries.set(code, cached);
        return cached.value;
    }
    const value = readJson(file).then(
        (raw) => new Map(decodePeople(raw).map((person) => [person.id, person]))
    );
    peopleEntries.delete(code);
    peopleEntries.set(code, { key, value });
    if (peopleEntries.size > PEOPLE_CACHE_LIMIT) {
        const oldest = peopleEntries.keys().next().value;
        if (oldest) {
            peopleEntries.delete(oldest);
        }
    }
    value.catch(() => {
        if (peopleEntries.get(code)?.value === value) {
            peopleEntries.delete(code);
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
    const { base } = derived.loaded;
    // The index lacks former officials without trips; the country file lists everyone.
    const detail = await loadDetail(code, derived, getToday());
    // Biographies and sources stay on the profiles: the directory never shows them.
    const listed = detail?.officials.map(
        (official): Official => ({ ...official, sources: [], summary: "" })
    );
    const officials = listed
        ? [...base.officials.filter((official) => official.countryCode !== code), ...listed]
        : base.officials;
    return buildCountryDirectory({ ...base, officials }, code, derived.recordsByOfficial);
});

const getOfficialProfile = cache(
    async (code: CountryCode, officialId: string): Promise<OfficialProfile | null> => {
        const derived = await getBase();
        const { base } = derived.loaded;
        const country = base.countries.find((candidate) => candidate.code === code);
        if (!country) {
            return null;
        }
        const compact = base.officials.find(
            (candidate) => candidate.id === officialId && candidate.countryCode === code
        );
        // The index lacks biographies, sources, trip purposes and former officials without
        // trips; the country file has them.
        const detail = await loadDetail(code, derived, getToday());
        const full = detail?.officials.find((candidate) => candidate.id === officialId);
        if (!(compact || full)) {
            // Not an official with a full record: perhaps a legislator, judge or diplomat.
            const person = (await loadPeople(code)).get(officialId);
            return person ? { country, official: person, records: [] } : null;
        }
        const official = full ?? compact;
        if (!official) {
            return null;
        }
        const records = (
            detail?.records.filter((record) => record.officialId === officialId) ??
            derived.recordsByOfficial.get(officialId) ??
            []
        ).toSorted(compareNewestFirst);

        return { country, official, records };
    }
);

const hasOfficial = cache(async (code: CountryCode, officialId: string) => {
    const derived = await getBase();
    const isIndexed = derived.loaded.base.officials.some(
        (official) => official.id === officialId && official.countryCode === code
    );
    if (isIndexed) {
        return true;
    }
    const detail = await loadDetail(code, derived, getToday());
    return (
        Boolean(detail?.officials.some((official) => official.id === officialId)) ||
        (await loadPeople(code)).has(officialId)
    );
});

export const leadersData: LeadersDataSource = {
    getContext,
    getCountryDirectory,
    getCountryList,
    getOfficialProfile,
    getOverview,
    hasOfficial,
};

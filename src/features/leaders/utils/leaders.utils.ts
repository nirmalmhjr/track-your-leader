import {
    OTHER_PARTY_COLOR_CLASS,
    PARTY_COLOR_CLASSES,
} from "@/features/leaders/constants/leaders.constants";
import type {
    CountryDirectory,
    CountryListItem,
    DestinationCount,
    DirectoryOverview,
    InOfficeGroups,
    LeaderEntry,
    PartyColors,
    TopTraveller,
    YearCount,
} from "@/features/leaders/types/leaders.types";
import type { TravelBase } from "@/features/travel-explorer/data/travel-index";
import { addMonths } from "@/lib/travel/date.utils";
import { countTenure } from "@/lib/travel/offices.utils";
import {
    getCategoryGroup,
    getCurrentPosition,
    getOfficialRank,
    getPrimaryPosition,
} from "@/lib/travel/officials.utils";
import type { PartyCount } from "@/lib/travel/party.utils";
import { summarizeTravel } from "@/lib/travel/travel-summary.utils";
import type { CountryCode } from "@/types/geo.types";
import type { IsoDate, Official, TravelRecord } from "@/types/travel.types";

const COUNTRY_PARAM_PATTERN = /^[a-z]{3}$/i;
const TOP_TRAVELLER_LIMIT = 12;
const RECENT_WINDOW_MONTHS = 12;

const isCountable = (record: TravelRecord): boolean => record.status !== "cancelled";

const isInOffice = (official: Official): boolean => getCurrentPosition(official) !== null;

/** Most senior first, then alphabetical. */
const compareBySeniority = (a: Official, b: Official): number =>
    getOfficialRank(a) - getOfficialRank(b) || a.fullName.localeCompare(b.fullName);

/**
 * Reads a country code from a URL segment such as `npl`.
 *
 * @param value - Raw route parameter.
 * @returns The upper-case code, or `null` when it can't be one.
 */
export const parseCountryParam = (value: string): CountryCode | null =>
    COUNTRY_PARAM_PATTERN.test(value) ? value.toUpperCase() : null;

/**
 * Groups every trip by the official who made it.
 *
 * @param base - Decoded dataset.
 * @returns Trips per official id, in dataset order.
 */
export const groupRecordsByOfficial = (base: TravelBase): Map<string, TravelRecord[]> => {
    const groups = new Map<string, TravelRecord[]>();
    for (const records of base.recordsByOrigin.values()) {
        for (const record of records) {
            const group = groups.get(record.officialId);
            if (group) {
                group.push(record);
            } else {
                groups.set(record.officialId, [record]);
            }
        }
    }
    return groups;
};

/**
 * Builds the country rail: every tracked country with its official and trip counts.
 *
 * @param base - Decoded dataset.
 * @returns One row per tracked country, in dataset order.
 */
export const buildCountryList = (base: TravelBase): CountryListItem[] => {
    const officialCounts = new Map<CountryCode, { all: number; current: number }>();
    for (const official of base.officials) {
        const counts = officialCounts.get(official.countryCode) ?? { all: 0, current: 0 };
        counts.all += 1;
        counts.current += isInOffice(official) ? 1 : 0;
        officialCounts.set(official.countryCode, counts);
    }

    return base.countries.map((country) => {
        const counts = officialCounts.get(country.code);
        const records = base.recordsByOrigin.get(country.code) ?? [];
        return {
            code: country.code,
            inOfficeCount: counts?.current ?? 0,
            officialCount: counts?.all ?? 0,
            tripCount: records.filter(isCountable).length,
        };
    });
};

/**
 * Builds a country's directory: its leaders in office with their travel, and everyone else.
 *
 * @param base - Decoded dataset.
 * @param code - Country to describe.
 * @param recordsByOfficial - Trips per official, from `groupRecordsByOfficial`.
 * @returns The directory, or `null` when the country isn't tracked.
 */
export const buildCountryDirectory = (
    base: TravelBase,
    code: CountryCode,
    recordsByOfficial: ReadonlyMap<string, readonly TravelRecord[]>
): CountryDirectory | null => {
    const country = base.countries.find((candidate) => candidate.code === code);
    if (!country) {
        return null;
    }

    const officials = base.officials.filter((official) => official.countryCode === code);
    const inOffice: LeaderEntry[] = officials
        .filter(isInOffice)
        .sort(compareBySeniority)
        .map((official) => ({
            official,
            summary: summarizeTravel(recordsByOfficial.get(official.id) ?? []),
        }));

    return {
        country,
        inOffice,
        officials,
        tenure: countTenure(officials),
        tripCount: (base.recordsByOrigin.get(code) ?? []).filter(isCountable).length,
    };
};

/**
 * Builds the landing page: dataset totals and the leaders in office who travelled most in the
 * past year.
 *
 * @param base - Decoded dataset.
 * @param recordsByOfficial - Trips per official, from `groupRecordsByOfficial`.
 * @param today - Reference date.
 * @returns Totals and up to twelve top travellers, busiest first.
 */
export const buildOverview = (
    base: TravelBase,
    recordsByOfficial: ReadonlyMap<string, readonly TravelRecord[]>,
    today: IsoDate
): DirectoryOverview => {
    const windowStart = addMonths(today, -RECENT_WINDOW_MONTHS);
    const isRecent = (record: TravelRecord): boolean =>
        record.status === "completed" &&
        record.startDate >= windowStart &&
        record.startDate <= today;

    const topTravellers: TopTraveller[] = base.officials
        .filter(isInOffice)
        .map((official) => {
            const records = recordsByOfficial.get(official.id) ?? [];
            return { official, recentTripCount: records.filter(isRecent).length, records };
        })
        .filter((entry) => entry.recentTripCount > 0)
        .sort(
            (a, b) =>
                b.recentTripCount - a.recentTripCount || compareBySeniority(a.official, b.official)
        )
        .slice(0, TOP_TRAVELLER_LIMIT)
        .map(({ official, recentTripCount, records }) => ({
            official,
            recentTripCount,
            summary: summarizeTravel(records),
        }));

    let tripCount = 0;
    for (const records of base.recordsByOrigin.values()) {
        tripCount += records.filter(isCountable).length;
    }

    return {
        countryCount: base.countries.length,
        officialCount: base.officials.length,
        topTravellers,
        tripCount,
    };
};

/**
 * Counts trips per calendar year, filling the years without travel so a chart has no gaps.
 *
 * @param records - Trips in any order.
 * @returns One entry per year from the first trip to the last, oldest first.
 */
export const countTripsByYear = (records: readonly TravelRecord[]): YearCount[] => {
    const counts = new Map<number, number>();
    for (const record of records) {
        if (isCountable(record)) {
            const year = Number(record.startDate.slice(0, 4));
            counts.set(year, (counts.get(year) ?? 0) + 1);
        }
    }
    if (counts.size === 0) {
        return [];
    }

    const years = [...counts.keys()];
    const first = Math.min(...years);
    const last = Math.max(...years);
    return Array.from({ length: last - first + 1 }, (_, index) => {
        const year = first + index;
        return { count: counts.get(year) ?? 0, year: String(year) };
    });
};

/**
 * Ranks the countries an official visited by number of trips.
 *
 * @param records - Trips in any order.
 * @param limit - Maximum number of countries to return.
 * @returns Destination countries, most visited first, ties alphabetical by code.
 */
export const rankDestinations = (
    records: readonly TravelRecord[],
    limit: number
): DestinationCount[] => {
    const counts = new Map<CountryCode, number>();
    for (const record of records) {
        if (isCountable(record)) {
            const code = record.destination.countryCode;
            counts.set(code, (counts.get(code) ?? 0) + 1);
        }
    }
    return [...counts.entries()]
        .map(([countryCode, count]) => ({ count, countryCode }))
        .sort((a, b) => b.count - a.count || a.countryCode.localeCompare(b.countryCode))
        .slice(0, limit);
};

/**
 * Orders the country rail alphabetically in the reader's language.
 *
 * @param countries - Rail rows.
 * @param names - Country names in the active locale.
 * @param locale - Active locale, for collation.
 * @returns The rows sorted by name.
 */
export const sortCountriesByName = (
    countries: readonly CountryListItem[],
    names: Readonly<Record<CountryCode, string>>,
    locale: string
): CountryListItem[] => {
    const collator = new Intl.Collator(locale);
    return countries.toSorted((a, b) =>
        collator.compare(names[a.code] ?? a.code, names[b.code] ?? b.code)
    );
};

/** Newest trip first; ties broken by id so the order is stable. */
export const compareNewestFirst = (a: TravelRecord, b: TravelRecord): number =>
    b.startDate.localeCompare(a.startDate) || a.id.localeCompare(b.id);

/**
 * Splits the leaders in office into the In office tab's sections, keeping their order.
 *
 * @param entries - Leaders in office, most senior first.
 * @returns Leadership, ministers, and everyone else.
 */
export const splitInOffice = (entries: readonly LeaderEntry[]): InOfficeGroups => {
    const groups: InOfficeGroups = { leadership: [], ministers: [], others: [] };
    for (const entry of entries) {
        const group = getCategoryGroup(getPrimaryPosition(entry.official).categories);
        if (group === "leadership") {
            groups.leadership.push(entry);
        } else if (group === "ministers") {
            groups.ministers.push(entry);
        } else {
            groups.others.push(entry);
        }
    }
    return groups;
};

/**
 * Gives each party a colour in the order the counts list them, so the largest parties get the
 * most distinct colours. A party listed twice keeps its first colour; parties beyond the
 * palette share a neutral one.
 *
 * @param counts - Party counts, most important first; may repeat parties.
 * @returns Colour class per party name. Unrecorded parties have no entry.
 */
export const assignPartyColors = (counts: readonly PartyCount[]): PartyColors => {
    const colors = new Map<string, string>();
    for (const { party } of counts) {
        if (party === null || colors.has(party)) {
            continue;
        }
        colors.set(party, PARTY_COLOR_CLASSES[colors.size] ?? OTHER_PARTY_COLOR_CLASS);
    }
    return colors;
};

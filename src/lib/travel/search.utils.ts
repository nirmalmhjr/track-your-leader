import { getCurrentPosition, getPrimaryPosition } from "@/lib/travel/officials.utils";
import { normalizeSearchText } from "@/lib/utils";
import type { Official, SearchPerson } from "@/types/travel.types";

/**
 * Search over countries and officials. Entries are prepared once (names normalised and split
 * into words); each query then ranks the matches and returns only the best few, so typing stays
 * fast however many officials there are.
 */

const WORD_SEPARATOR = /[\s,.'’()-]+/;

/** Countries listed once a query is typed; few enough that people stay in view below them. */
export const SEARCH_COUNTRY_LIMIT = 6;
/** People listed for a query, so a short one never floods the list with unrelated names. */
export const SEARCH_PEOPLE_LIMIT = 8;
/** Characters a query needs before people are searched; one letter matches thousands. */
export const SEARCH_PEOPLE_MIN_QUERY_LENGTH = 2;

/** Match quality, best first. */
const MATCH_RANK = { anywhere: 3, nameStart: 1, wholeWord: 0, wordStart: 2 } as const;
type MatchRank = (typeof MATCH_RANK)[keyof typeof MATCH_RANK];

export interface SearchEntry<T> {
    /** Holds an office now (shown before former office holders). */
    isCurrent: boolean;
    item: T;
    /** Normalised display name. */
    name: string;
    /** Normalised text searched beyond the name (title, country, aliases). */
    text: string;
    /** Number of trips, a tie-breaker that surfaces the best-known people. */
    trips: number;
    words: string[];
}

/**
 * Prepares an entry for searching.
 *
 * @param item - The value returned when the entry matches.
 * @param name - Display name.
 * @param extra - Other searchable text.
 * @param ranking - Tie-breakers.
 * @returns The entry.
 */
export const createSearchEntry = <T>(
    item: T,
    name: string,
    extra: readonly string[],
    { isCurrent = false, trips = 0 }: { isCurrent?: boolean; trips?: number } = {}
): SearchEntry<T> => {
    const normalizedName = normalizeSearchText(name);
    const text = normalizeSearchText([name, ...extra].join(" "));
    return {
        isCurrent,
        item,
        name: normalizedName,
        text,
        trips,
        words: text.split(WORD_SEPARATOR).filter(Boolean),
    };
};

/**
 * Rates how well an entry matches, for callers that order matches themselves.
 *
 * @param entry - Prepared entry.
 * @param query - Query already passed through `normalizeSearchText`.
 * @returns The match rank (lower is better), or `null` when the entry does not match.
 */
export const rankSearchEntry = <T>(entry: SearchEntry<T>, query: string): MatchRank | null => {
    // "modi" finds Narendra Modi before Modibo Keïta.
    if (entry.name === query || entry.words.includes(query)) {
        return MATCH_RANK.wholeWord;
    }
    if (entry.name.startsWith(query)) {
        return MATCH_RANK.nameStart;
    }
    if (entry.words.some((word) => word.startsWith(query))) {
        return MATCH_RANK.wordStart;
    }
    return entry.text.includes(query) ? MATCH_RANK.anywhere : null;
};

interface RankedMatch<T> {
    entry: SearchEntry<T>;
    rank: MatchRank;
}

/**
 * Every entry matching an already normalised query, best first: by match quality, then current
 * office holders, then the most travelled, then alphabetical.
 */
const rankMatches = <T>(entries: readonly SearchEntry<T>[], query: string): RankedMatch<T>[] => {
    const matches: RankedMatch<T>[] = [];
    for (const entry of entries) {
        const rank = rankSearchEntry(entry, query);
        if (rank !== null) {
            matches.push({ entry, rank });
        }
    }
    return matches.sort(
        (a, b) =>
            a.rank - b.rank ||
            Number(b.entry.isCurrent) - Number(a.entry.isCurrent) ||
            b.entry.trips - a.entry.trips ||
            a.entry.name.localeCompare(b.entry.name)
    );
};

/**
 * Finds the best matches for a query.
 *
 * @param entries - Prepared entries.
 * @param query - Text typed by the user.
 * @param limit - Maximum number of results.
 * @returns Matching items, best first: whole-word matches, then names starting with the query,
 * then words starting with it, then partial matches; ties go to
 * current office holders, then the most travelled, then alphabetical.
 */
export const searchEntries = <T>(
    entries: readonly SearchEntry<T>[],
    query: string,
    limit: number
): T[] => {
    const normalized = normalizeSearchText(query);
    if (!normalized) {
        return [];
    }
    return rankMatches(entries, normalized)
        .slice(0, limit)
        .map(({ entry }) => entry.item);
};

export interface CountryAndPeopleResults<C, P> {
    countries: C[];
    people: P[];
    /** The best person matches better than the best country ("oli" finds K. P. Sharma Oli). */
    peopleFirst: boolean;
    /** The query is long enough for people to be searched. */
    searchesPeople: boolean;
}

/**
 * Searches the header's two groups at once. Without a query every country is listed and no one
 * else; with one, the best few countries and, from two characters, the best few people.
 *
 * @param countries - Prepared country entries, in the order to list them without a query.
 * @param people - Prepared person entries, or `null` while they are still loading.
 * @param query - Text typed by the user.
 * @returns Both groups and which one to list first.
 */
export const searchCountriesAndPeople = <C, P>(
    countries: readonly SearchEntry<C>[],
    people: readonly SearchEntry<P>[] | null,
    query: string
): CountryAndPeopleResults<C, P> => {
    const normalized = normalizeSearchText(query);
    if (!normalized) {
        return {
            countries: countries.map((entry) => entry.item),
            people: [],
            peopleFirst: false,
            searchesPeople: false,
        };
    }
    const countryMatches = rankMatches(countries, normalized).slice(0, SEARCH_COUNTRY_LIMIT);
    const searchesPeople = normalized.length >= SEARCH_PEOPLE_MIN_QUERY_LENGTH;
    const personMatches =
        searchesPeople && people
            ? rankMatches(people, normalized).slice(0, SEARCH_PEOPLE_LIMIT)
            : [];
    const bestCountryRank = countryMatches[0]?.rank ?? Number.POSITIVE_INFINITY;
    const bestPersonRank = personMatches[0]?.rank ?? Number.POSITIVE_INFINITY;
    return {
        countries: countryMatches.map(({ entry }) => entry.item),
        people: personMatches.map(({ entry }) => entry.item),
        peopleFirst: bestPersonRank < bestCountryRank,
        searchesPeople,
    };
};

/**
 * Describes an official for the header search.
 *
 * @param official - Official to describe.
 * @param tripCount - Their recorded trips.
 * @returns The search listing.
 */
export const toSearchPerson = (official: Official, tripCount: number): SearchPerson => ({
    countryCode: official.countryCode,
    fullName: official.fullName,
    id: official.id,
    isCurrent: getCurrentPosition(official) !== null,
    title: getPrimaryPosition(official).title,
    tripCount,
});

/**
 * Prepares a person for searching: found by name, title or country name.
 *
 * @param person - The person.
 * @param countryName - Their country's name in the active language.
 * @returns The search entry.
 */
export const createPersonSearchEntry = (
    person: SearchPerson,
    countryName: string
): SearchEntry<SearchPerson> =>
    createSearchEntry(person, person.fullName, [person.title, countryName], {
        isCurrent: person.isCurrent,
        trips: person.tripCount,
    });

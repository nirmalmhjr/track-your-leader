import { normalizeSearchText } from "@/features/travel-explorer/utils/filters.utils";

/**
 * Search over countries and officials. Entries are prepared once (names normalised and split
 * into words); each query then ranks the matches and returns only the best few, so typing stays
 * fast however many officials there are.
 */

const WORD_SEPARATOR = /[\s,.'’()-]+/;

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
    const matches: { entry: SearchEntry<T>; rank: MatchRank }[] = [];
    for (const entry of entries) {
        const rank = rankSearchEntry(entry, normalized);
        if (rank !== null) {
            matches.push({ entry, rank });
        }
    }
    return matches
        .sort(
            (a, b) =>
                a.rank - b.rank ||
                Number(b.entry.isCurrent) - Number(a.entry.isCurrent) ||
                b.entry.trips - a.entry.trips ||
                a.entry.name.localeCompare(b.entry.name)
        )
        .slice(0, limit)
        .map(({ entry }) => entry.item);
};

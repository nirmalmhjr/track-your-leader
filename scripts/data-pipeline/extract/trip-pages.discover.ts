import { normalizeName, stripParenthetical } from "../lib/text";
import { listTitlesWithPrefix } from "../sources/wikipedia";
import { TRIP_PAGE_OVERRIDES } from "./trip-pages.overrides";

/**
 * Finds the Wikipedia trip-list pages of officials, e.g. "List of international prime
 * ministerial trips made by Narendra Modi" or "List of international trips made by Marco Rubio
 * as United States Secretary of State". Every such page title is listed once, then matched to
 * officials by name, which scales to every country without a search per person.
 */

const TRIP_LIST_PREFIX = "List of international";
const TRIP_LIST_TITLE =
    /^List of international (?:[\w-]+ )*trips made by (.+?)(?: as .+?)?(?: \([^)]*\))?$/i;
const DOMESTIC = /\bdomestic\b/i;

export interface TripPageCandidate {
    /** English Wikipedia article about the person. */
    article: string;
    /** Caller's key for the person (a Wikidata id). */
    key: string;
}

export interface TripPage {
    key: string;
    title: string;
}

/**
 * Name of the person a trip-list page is about.
 *
 * @param pageTitle - Page title.
 * @returns The normalised name, or `null` for other pages (domestic trips, single countries).
 */
const subjectOf = (pageTitle: string): string | null => {
    const match = pageTitle.match(TRIP_LIST_TITLE);
    return match?.[1] && !DOMESTIC.test(pageTitle) ? normalizeName(match[1]) : null;
};

/**
 * Finds the trip-list pages of the given people.
 *
 * @param candidates - People to look for, with their article titles.
 * @returns Pages to parse, each tagged with its person's key.
 */
export const discoverTripPages = async (
    candidates: readonly TripPageCandidate[]
): Promise<TripPage[]> => {
    const pagesBySubject = new Map<string, string[]>();
    for (const title of await listTitlesWithPrefix(TRIP_LIST_PREFIX)) {
        const subject = subjectOf(title);
        if (subject) {
            pagesBySubject.set(subject, [...(pagesBySubject.get(subject) ?? []), title]);
        }
    }

    return candidates.flatMap(({ article, key }) => {
        // Exact name: "…trips made by Donald Trump to China" is about one country, not the person.
        const found = pagesBySubject.get(normalizeName(stripParenthetical(article))) ?? [];
        const override = TRIP_PAGE_OVERRIDES[key];
        const pages = [...found, ...(override?.add ?? [])].filter(
            (title) => !override?.exclude?.includes(title)
        );
        return [...new Set(pages)].map((title) => ({ key, title }));
    });
};

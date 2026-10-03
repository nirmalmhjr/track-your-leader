import type { GeneratedOfficial } from "@/features/travel-explorer/data/generated-data.schema";

import { mapWithConcurrency } from "../lib/collections";
import { normalizeName, stripParenthetical } from "../lib/text";
import { searchTitles } from "../sources/wikipedia";
import { TRIP_PAGE_OVERRIDES } from "./trip-pages.overrides";

/**
 * Finds the Wikipedia trip-list pages of each leader and foreign minister, e.g.
 * "List of international prime ministerial trips made by Narendra Modi" or
 * "List of international trips made by Marco Rubio as United States Secretary of State".
 */

const SEARCH_CONCURRENCY = 3;
const TRIP_LIST_TITLE =
    /^List of international (?:[\w-]+ )*trips made by (.+?)(?: as .+?)?(?: \([^)]*\))?$/i;
const DOMESTIC = /\bdomestic\b/i;
const WIKIPEDIA_ARTICLE = "https://en.wikipedia.org/wiki/";

export interface TripPage {
    officialId: string;
    title: string;
}

/** Officials whose trips Wikipedia tends to list. */
const travelsOften = (official: GeneratedOfficial): boolean =>
    official.positions.some(
        (position) =>
            position.portfolio === "foreign_affairs" ||
            position.categories.some((category) =>
                ["head_of_state", "head_of_government", "deputy_leader"].includes(category)
            )
    );

const articleTitleOf = (official: GeneratedOfficial): string | null => {
    const source = official.sources.find((candidate) =>
        candidate.url.startsWith(WIKIPEDIA_ARTICLE)
    );
    return source
        ? decodeURIComponent(source.url.slice(WIKIPEDIA_ARTICLE.length)).replaceAll("_", " ")
        : null;
};

const isTripListFor = (pageTitle: string, personName: string): boolean => {
    const match = pageTitle.match(TRIP_LIST_TITLE);
    // Exact name: "…trips made by Donald Trump to China" is about one country, not the person.
    return (
        Boolean(match?.[1]) &&
        !DOMESTIC.test(pageTitle) &&
        normalizeName(match?.[1] ?? "") === normalizeName(personName)
    );
};

/**
 * Searches Wikipedia for each official's trip-list pages.
 *
 * @param officials - All officials.
 * @returns Pages to parse, each tagged with its official.
 */
export const discoverTripPages = async (
    officials: readonly GeneratedOfficial[]
): Promise<TripPage[]> => {
    const candidates = officials.flatMap((official) => {
        const article = articleTitleOf(official);
        return article && travelsOften(official) ? [{ article, official }] : [];
    });

    const found = await mapWithConcurrency(
        candidates,
        SEARCH_CONCURRENCY,
        async ({ article, official }) => {
            const name = stripParenthetical(article);
            const titles = await searchTitles(`intitle:trips "${name}"`);
            const override = official.wikidataId
                ? TRIP_PAGE_OVERRIDES[official.wikidataId]
                : undefined;
            const pages = [
                ...titles.filter((title) => isTripListFor(title, name)),
                ...(override?.add ?? []),
            ].filter((title) => !override?.exclude?.includes(title));
            return [...new Set(pages)].map((title) => ({ officialId: official.id, title }));
        }
    );
    return found.flat();
};

import { z } from "zod";

import { chunk } from "../lib/collections";
import { fetchJson, withQuery } from "../lib/http";

/**
 * Wikipedia: trip-list pages ("List of international prime ministerial trips made by …", and
 * their counterparts on other Wikipedias) and short English biographies. Text is CC BY-SA, so
 * the app credits Wikipedia.
 */

/**
 * Wikipedias read for trip lists. English is the default everywhere; the others hold lists
 * English lacks (Portuguese for Latin America, Persian and Arabic for the Middle East…).
 */
export const WIKI_LANGUAGES = ["en", "es", "fr", "pt", "de", "id", "ko", "ar", "fa"] as const;
export type WikiLanguage = (typeof WIKI_LANGUAGES)[number];

const apiEndpoint = (language: WikiLanguage): string =>
    `https://${language}.wikipedia.org/w/api.php`;
const TITLE_BATCH_SIZE = 50;
/** The extracts API returns at most 20 intros per request. */
const EXTRACT_BATCH_SIZE = 20;
const SEARCH_LIMIT = 20;
/** The search API's own ceiling per request. */
const MAX_SEARCH_LIMIT = 500;
const INTRO_SENTENCES = 2;

const titleMapSchema = z.array(z.object({ from: z.string(), to: z.string() })).optional();

const pagesResponseSchema = z.object({
    query: z
        .object({
            normalized: titleMapSchema,
            pages: z.array(
                z.object({
                    extract: z.string().optional(),
                    missing: z.boolean().optional(),
                    pageprops: z.object({ wikibase_item: z.string().optional() }).optional(),
                    title: z.string(),
                })
            ),
            redirects: titleMapSchema,
        })
        .optional(),
});

const parseResponseSchema = z.object({
    parse: z.object({ text: z.string(), title: z.string() }).optional(),
});

const searchResponseSchema = z.object({
    continue: z.object({ sroffset: z.number() }).optional(),
    query: z.object({ search: z.array(z.object({ title: z.string() })) }),
});

type PagesResponse = z.infer<typeof pagesResponseSchema>;
type PageInfo = NonNullable<PagesResponse["query"]>["pages"][number];

/**
 * Public URL of an article.
 *
 * @param title - Article title.
 * @param language - Wikipedia language.
 * @returns The article URL.
 */
export const wikipediaUrl = (title: string, language: WikiLanguage = "en"): string =>
    `https://${language}.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(" ", "_"))}`;

/**
 * Full-text search over article titles and text.
 *
 * @param query - CirrusSearch query, e.g. `intitle:trips "Narendra Modi"`.
 * @param language - Wikipedia language.
 * @param limit - Most results wanted (up to 500).
 * @returns Matching article titles.
 */
export const searchTitles = async (
    query: string,
    language: WikiLanguage = "en",
    limit = SEARCH_LIMIT
): Promise<string[]> => {
    const json = await fetchJson(
        withQuery(apiEndpoint(language), {
            action: "query",
            format: "json",
            formatversion: "2",
            list: "search",
            srlimit: String(Math.min(limit, MAX_SEARCH_LIMIT)),
            srnamespace: "0",
            srsearch: query,
        })
    );
    return searchResponseSchema.parse(json).query.search.map((result) => result.title);
};

/** The search API serves at most this many results for one query. */
const MAX_SEARCH_RESULTS = 10_000;

/**
 * Full-text search that follows the result pages, for queries matching more than 500 articles.
 *
 * @param query - CirrusSearch query, e.g. `intitle:relations "high-level visits"`.
 * @param language - Wikipedia language.
 * @returns Every matching article title.
 */
export const searchAllTitles = async (
    query: string,
    language: WikiLanguage = "en"
): Promise<string[]> => {
    const titles: string[] = [];
    let offset: number | undefined = 0;
    while (offset !== undefined && offset < MAX_SEARCH_RESULTS) {
        // biome-ignore lint/performance/noAwaitInLoops: each page of results names where the next one starts.
        const json = await fetchJson(
            withQuery(apiEndpoint(language), {
                action: "query",
                format: "json",
                formatversion: "2",
                list: "search",
                srlimit: String(MAX_SEARCH_LIMIT),
                srnamespace: "0",
                sroffset: String(offset),
                srsearch: query,
            })
        );
        const page = searchResponseSchema.parse(json);
        titles.push(...page.query.search.map((result) => result.title));
        offset = page.continue?.sroffset;
    }
    return titles;
};

const allPagesResponseSchema = z.object({
    continue: z.object({ apcontinue: z.string() }).optional(),
    query: z.object({ allpages: z.array(z.object({ title: z.string() })) }),
});

/**
 * Lists every article whose title starts with a prefix, following the API's continuation.
 *
 * @param prefix - Title prefix without its namespace, e.g. "List of international".
 * @param language - Wikipedia language.
 * @param namespace - Namespace number: 0 for articles, 104 for Spanish "Anexo:" lists.
 * @returns The full titles, redirects excluded.
 */
export const listTitlesWithPrefix = async (
    prefix: string,
    language: WikiLanguage = "en",
    namespace = 0
): Promise<string[]> => {
    const titles: string[] = [];
    let from: string | undefined;
    do {
        // biome-ignore lint/performance/noAwaitInLoops: each page of results names where the next one starts.
        const json = await fetchJson(
            withQuery(apiEndpoint(language), {
                action: "query",
                apfilterredir: "nonredirects",
                aplimit: "max",
                apnamespace: String(namespace),
                apprefix: prefix,
                format: "json",
                formatversion: "2",
                list: "allpages",
                ...(from ? { apcontinue: from } : {}),
            })
        );
        const page = allPagesResponseSchema.parse(json);
        titles.push(...page.query.allpages.map((entry) => entry.title));
        from = page.continue?.apcontinue;
    } while (from);
    return titles;
};

/**
 * Fetches an article's rendered HTML (templates such as flags and dates already expanded).
 *
 * @param title - Article title; redirects are followed.
 * @param language - Wikipedia language.
 * @returns The final title and HTML, or `null` if the page doesn't exist.
 */
export const fetchArticleHtml = async (
    title: string,
    language: WikiLanguage = "en"
): Promise<{ html: string; title: string } | null> => {
    const json = await fetchJson(
        withQuery(apiEndpoint(language), {
            action: "parse",
            disableeditsection: "1",
            disabletoc: "1",
            format: "json",
            formatversion: "2",
            page: title,
            prop: "text",
            redirects: "1",
        })
    ).catch(() => null);
    const page = parseResponseSchema.safeParse(json);
    return page.success && page.data.parse
        ? { html: page.data.parse.text, title: page.data.parse.title }
        : null;
};

/** Follows the API's normalisation and redirect hops from a requested title to its page. */
const resolveRequestedTitles = (
    requested: readonly string[],
    query: NonNullable<PagesResponse["query"]>
): Map<string, PageInfo> => {
    const hops = new Map<string, string>();
    for (const hop of [...(query.normalized ?? []), ...(query.redirects ?? [])]) {
        hops.set(hop.from, hop.to);
    }
    const pageByTitle = new Map(query.pages.map((page) => [page.title, page]));

    const resolved = new Map<string, PageInfo>();
    for (const title of requested) {
        let current = title;
        for (let step = 0; step < 3 && hops.has(current); step += 1) {
            current = hops.get(current) ?? current;
        }
        const page = pageByTitle.get(current);
        if (page && !page.missing) {
            resolved.set(title, page);
        }
    }
    return resolved;
};

const queryPages = async (
    titles: readonly string[],
    batchSize: number,
    params: Readonly<Record<string, string>>,
    language: WikiLanguage = "en"
): Promise<Map<string, PageInfo>> => {
    const pages = new Map<string, PageInfo>();
    const batches = chunk([...new Set(titles)].sort(), batchSize);
    const responses = await Promise.all(
        batches.map((batch) =>
            fetchJson(
                withQuery(apiEndpoint(language), {
                    action: "query",
                    format: "json",
                    formatversion: "2",
                    redirects: "1",
                    titles: batch.join("|"),
                    ...params,
                })
            )
        )
    );
    for (const [index, json] of responses.entries()) {
        const batch = batches[index];
        const { query } = pagesResponseSchema.parse(json);
        if (query) {
            for (const [title, page] of resolveRequestedTitles(batch, query)) {
                pages.set(title, page);
            }
        }
    }
    return pages;
};

/**
 * Maps article titles to their Wikidata items.
 *
 * @param titles - Article titles as linked from pages (redirects are followed).
 * @param language - Wikipedia the titles belong to.
 * @returns Item id per requested title; titles without an item are left out.
 */
export const fetchWikidataIds = async (
    titles: readonly string[],
    language: WikiLanguage = "en"
): Promise<Map<string, string>> => {
    const pages = await queryPages(
        titles,
        TITLE_BATCH_SIZE,
        { ppprop: "wikibase_item", prop: "pageprops" },
        language
    );
    const ids = new Map<string, string>();
    for (const [title, page] of pages) {
        const id = page.pageprops?.wikibase_item;
        if (id) {
            ids.set(title, id);
        }
    }
    return ids;
};

/**
 * Fetches the first sentences of articles as plain text.
 *
 * @param titles - Article titles.
 * @returns Intro text per title.
 */
export const fetchIntros = async (titles: readonly string[]): Promise<Map<string, string>> => {
    const pages = await queryPages(titles, EXTRACT_BATCH_SIZE, {
        exintro: "1",
        exlimit: String(EXTRACT_BATCH_SIZE),
        explaintext: "1",
        exsentences: String(INTRO_SENTENCES),
        prop: "extracts",
    });
    const intros = new Map<string, string>();
    for (const [title, page] of pages) {
        if (page.extract) {
            intros.set(title, page.extract);
        }
    }
    return intros;
};

import { load } from "cheerio";

import { mapWithConcurrency } from "../lib/collections";
import { fetchText } from "../lib/http";
import { cleanText } from "../lib/text";

/**
 * Ministry of Foreign Affairs of Nepal (mofa.gov.np): press releases, including visits abroad
 * by the President, Vice President, Prime Minister and Foreign Minister. Only the current site
 * is read; the older archive (old.mofa.gov.np) fails certificate checks and refuses plain HTTP.
 */

const SITE = "https://mofa.gov.np";
const MAX_PAGES = 100;
const ITEM_CONCURRENCY = 2;
const PUBLISHED = /([A-Z][a-z]+ \d{1,2}, \d{4}),\s+\d{1,2}:\d{2}/;

export interface MofaPressItem {
    body: string;
    /** Publication date as written, e.g. "June 14, 2026". */
    published: string | null;
    title: string;
    url: string;
}

const listPressItems = async (): Promise<{ title: string; url: string }[]> => {
    const items = new Map<string, string>();
    for (let page = 1; page <= MAX_PAGES; page += 1) {
        // biome-ignore lint/performance/noAwaitInLoops: pages are read in order until one adds nothing new.
        const $ = load(await fetchText(`${SITE}/category/presscategory/?page=${page}`));
        const before = items.size;
        for (const link of $("h3.item__title a").toArray()) {
            const href = $(link).attr("href");
            if (href) {
                items.set(new URL(href, SITE).toString(), cleanText($(link).text()));
            }
        }
        // Pages past the end repeat the last page.
        if (items.size === before) {
            break;
        }
    }
    return [...items].map(([url, title]) => ({ title, url }));
};

/**
 * Lists press releases and reads the ones `keep` selects by title.
 *
 * @param keep - Title filter, so only likely visit announcements are downloaded.
 * @returns Selected items with their text and publication date.
 */
export const fetchMofaPressItems = async (
    keep: (title: string) => boolean
): Promise<MofaPressItem[]> => {
    const selected = (await listPressItems()).filter((item) => keep(item.title));
    return mapWithConcurrency(selected, ITEM_CONCURRENCY, async ({ title, url }) => {
        const $ = load(await fetchText(url));
        const body = cleanText($("main").text());
        return { body, published: body.match(PUBLISHED)?.[1] ?? null, title, url };
    });
};

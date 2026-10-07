import { setTimeout as sleep } from "node:timers/promises";

import { load } from "cheerio";

import { fetchText } from "../lib/http";
import { log } from "../lib/log";
import { cleanText } from "../lib/text";

/**
 * The Kremlin's record of the Russian President's events (en.kremlin.ru), 2000 on: every
 * meeting and talks, with its date and place. A meeting with a foreign leader in Moscow or Sochi
 * is that leader's visit to Russia; one in New Delhi puts them in India that day. Licensed
 * CC BY 4.0 ("All content on this site is licensed under Creative Commons Attribution 4.0
 * International"; agency photos excepted, and none are used).
 */

const SITE = "http://en.kremlin.ru";
const LIST_PATH = "/events/president/news";
/** About 1,550 pages of 20 events today; the bound only stops a runaway loop. */
const MAX_PAGES = 3000;
/** This many pages refused in a row, despite pauses, means the site is blocking us: stop. */
const MAX_REFUSED_IN_A_ROW = 3;

export const KREMLIN_URL = SITE;

export interface KremlinEvent {
    /** "2019-10-23". */
    date: string;
    /** "Sochi", "The Kremlin, Moscow", "New Delhi"; `null` for phone calls and statements. */
    place: string | null;
    /** "Meeting with President of Egypt Abdel Fattah el-Sisi". */
    title: string;
    url: string;
}

/**
 * Reads one page of the event list.
 *
 * @param html - The list page.
 * @returns Its events, and whether an older page follows.
 */
export const parseKremlinList = (html: string): { events: KremlinEvent[]; hasNext: boolean } => {
    const $ = load(html);
    const events = $(".hentry")
        .toArray()
        .flatMap((entry): KremlinEvent[] => {
            const link = $(entry).find(".hentry__title a").first();
            const title = cleanText($(entry).find(".entry-title").first().text());
            const date = $(entry).find("time.published").attr("datetime");
            const href = link.attr("href");
            const place = cleanText($(entry).find(".hentry__location").first().text());
            return title && date && href
                ? [{ date, place: place || null, title, url: new URL(href, SITE).toString() }]
                : [];
        });
    return { events, hasNext: $('a[rel="next"]').length > 0 };
};

/** Pages this far back hold old events, which don't change: re-read monthly. */
const RECENT_PAGES = 20;
const OLD_PAGE_TTL_HOURS = 30 * 24;
/** The site refuses requests for a minute or so after a burst; it is asked again after this. */
const REFUSAL_PAUSE_MS = 60_000;
const ATTEMPTS = 3;

/** One list page, asked again after a pause when the site refuses it; `null` if it never answers. */
const fetchPage = async (page: number): Promise<string | null> => {
    const path = page === 1 ? LIST_PATH : `${LIST_PATH}/page/${page}`;
    const ttlHours = page > RECENT_PAGES ? OLD_PAGE_TTL_HOURS : undefined;
    for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
        try {
            // biome-ignore lint/performance/noAwaitInLoops: a refused page is asked again after a pause.
            return await fetchText(`${SITE}${path}`, { ttlHours });
        } catch (error) {
            log.warn(
                `Kremlin page ${page} refused (${(error as Error).message}); waiting a minute`
            );
            await sleep(REFUSAL_PAUSE_MS);
        }
    }
    return null;
};

/**
 * Every event in the list, newest first.
 *
 * @returns The events.
 */
export const fetchKremlinEvents = async (): Promise<KremlinEvent[]> => {
    const events = new Map<string, KremlinEvent>();
    let refused = 0;
    for (let page = 1; page <= MAX_PAGES && refused < MAX_REFUSED_IN_A_ROW; page += 1) {
        // biome-ignore lint/performance/noAwaitInLoops: pages are read in order until the last.
        const html = await fetchPage(page);
        if (html === null) {
            refused += 1;
            continue;
        }
        refused = 0;
        const { events: found, hasNext } = parseKremlinList(html);
        for (const event of found) {
            events.set(event.url, event);
        }
        if (!hasNext || found.length === 0) {
            break;
        }
    }
    return [...events.values()];
};

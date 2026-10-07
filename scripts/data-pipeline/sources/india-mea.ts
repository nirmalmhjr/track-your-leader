import { load } from "cheerio";

import { fetchText } from "../lib/http";
import { cleanText } from "../lib/text";

/**
 * Ministry of External Affairs of India (mea.gov.in): its lists of incoming visits (every
 * foreign leader and minister received in India, 2005 on) and outgoing visits (India's Prime
 * Minister, President, Vice President and External Affairs Minister abroad). Being a host's
 * record, the incoming list covers the leaders of every country, monarchs included, whom other
 * sources often miss. The site's pages load the lists from the endpoint read here.
 *
 * Copyright: MEA's content may not be reproduced without permission. Only facts are kept (who
 * travelled where, and when), with a link to MEA's page; no text is copied.
 */

const SITE = "https://www.mea.gov.in";
const LIST_ENDPOINT = `${SITE}/FrontEnd/FetchVisitListingData`;
const PAGE_SIZE = 500;
/** More than the archive needs (about 1,500 visits per direction would take 3 pages). */
const MAX_PAGES = 10;
const VISIT_TYPES = { incoming: 1, outgoing: 2 } as const;
/** Zero-width characters some headlines carry ("Visit of\u200b Minister…"). */
const ZERO_WIDTH = /[\u200b-\u200f\u2060\ufeff]/g;

export type MeaDirection = keyof typeof VISIT_TYPES;

export interface MeaVisit {
    direction: MeaDirection;
    /** When MEA listed the visit, as written ("01 October, 2026"); usually just before it. */
    listed: string;
    /** "State Visit of President of the Swiss Confederation to India (05-07 October, 2026)". */
    title: string;
    url: string;
}

const listUrl = (direction: MeaDirection, page: number): string =>
    `${LIST_ENDPOINT}?${new URLSearchParams({
        DateRange: "",
        IsInternalMEA: "false",
        KeywordName: "",
        PageSize: String(PAGE_SIZE),
        PLngId: "1",
        page: String(page),
        SortBy: "",
        visitType: String(VISIT_TYPES[direction]),
    })}`;

/**
 * Reads one page of the visit list.
 *
 * @param html - The endpoint's HTML fragment.
 * @param direction - Which list it is.
 * @returns The visits on the page.
 */
export const parseMeaVisitList = (html: string, direction: MeaDirection): MeaVisit[] => {
    const $ = load(html);
    return $(".visitBox")
        .toArray()
        .flatMap((box) => {
            const link = $(box).find("h3 a").first();
            const title = cleanText(link.text().replace(ZERO_WIDTH, ""));
            const href = link.attr("href");
            return title && href
                ? [
                      {
                          direction,
                          listed: cleanText($(box).find(".visitDate").first().text()),
                          title,
                          url: new URL(href, `${SITE}/`).toString(),
                      },
                  ]
                : [];
        });
};

/**
 * Every visit in one direction, all pages.
 *
 * @param direction - Incoming or outgoing.
 * @returns The visits, newest first.
 */
export const fetchMeaVisits = async (direction: MeaDirection): Promise<MeaVisit[]> => {
    const visits = new Map<string, MeaVisit>();
    for (let page = 1; page <= MAX_PAGES; page += 1) {
        // biome-ignore lint/performance/noAwaitInLoops: pages are read in order until one adds nothing new.
        const found = parseMeaVisitList(await fetchText(listUrl(direction, page)), direction);
        const before = visits.size;
        for (const visit of found) {
            visits.set(visit.url, visit);
        }
        if (found.length < PAGE_SIZE || visits.size === before) {
            break;
        }
    }
    return [...visits.values()];
};

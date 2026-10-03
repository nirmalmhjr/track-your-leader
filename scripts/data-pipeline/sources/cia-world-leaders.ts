import { z } from "zod";

import type { IsoDate } from "@/features/travel-explorer/types/travel.types";

import { fetchJson } from "../lib/http";

/**
 * CIA World Leaders: the current head of state, government and cabinet of every foreign
 * government (not the US), updated every few months. Public domain.
 *
 * The site is a static Gatsby build, so each country page has a `page-data.json` twin with the
 * same list in structured form — no HTML scraping needed.
 */

const SITE = "https://www.cia.gov/resources/world-leaders";
const DATE_LENGTH = 10;

const leaderSchema = z.object({
    name: z.string(),
    title: z.string(),
});

const pageDataSchema = z.object({
    result: z.object({
        data: z.object({
            page: z.object({
                country: z.string(),
                date_updated: z.string(),
                leaders: z.array(leaderSchema),
            }),
        }),
    }),
});

export interface CiaCabinetEntry {
    /** As published, e.g. "Balendra SHAH". */
    name: string;
    /** As published, abbreviated, e.g. "Min. of Foreign Affairs". */
    title: string;
}

export interface CiaCabinet {
    entries: readonly CiaCabinetEntry[];
    /** Date the CIA last updated the page. */
    updatedOn: IsoDate;
    /** Human-readable page, used as the source link. */
    url: string;
}

/**
 * Public page of a country on the CIA World Leaders site.
 *
 * @param slug - Country slug, e.g. `korea-south`.
 * @returns The page URL.
 */
export const ciaPageUrl = (slug: string): string => `${SITE}/foreign-governments/${slug}/`;

/**
 * Fetches a country's leaders and cabinet.
 *
 * @param slug - Country slug on the CIA site.
 * @returns The cabinet list with the date it was last updated.
 */
export const fetchCiaCabinet = async (slug: string): Promise<CiaCabinet> => {
    const json = await fetchJson(`${SITE}/page-data/foreign-governments/${slug}/page-data.json`);
    const { page } = pageDataSchema.parse(json).result.data;

    return {
        entries: page.leaders
            .map((leader) => ({ name: leader.name.trim(), title: leader.title.trim() }))
            .filter((leader) => leader.name && leader.title),
        updatedOn: page.date_updated.slice(0, DATE_LENGTH),
        url: ciaPageUrl(slug),
    };
};

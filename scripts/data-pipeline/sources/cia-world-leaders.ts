import { z } from "zod";

import type { IsoDate } from "@/types/travel.types";

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

const pageHashesSchema = z.object({ staticQueryHashes: z.array(z.string()) });
const countryListSchema = z.object({
    data: z.object({ leaders: z.object({ nodes: z.array(z.object({ country: z.string() })) }) }),
});
const APOSTROPHES = /['’]/g;
const NON_ALPHANUMERIC = /[^a-z0-9]+/g;
const EDGE_HYPHENS = /^-+|-+$/g;

/**
 * Page slug the CIA site derives from a country name ("Korea, South" → `korea-south`).
 *
 * @param name - Country name as the CIA writes it.
 * @returns The slug.
 */
export const ciaSlugOf = (name: string): string =>
    name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(APOSTROPHES, "")
        .replace(NON_ALPHANUMERIC, "-")
        .replace(EDGE_HYPHENS, "");

/**
 * Names of every government the CIA lists. The index page loads them through a Gatsby static
 * query whose file name is a hash, so the hashes are read from the index's page data first.
 *
 * @returns Country names as the CIA writes them ("Korea, South").
 */
export const fetchCiaCountryNames = async (): Promise<string[]> => {
    const index = pageHashesSchema.parse(
        await fetchJson(`${SITE}/page-data/foreign-governments/page-data.json`)
    );
    for (const hash of index.staticQueryHashes) {
        // biome-ignore lint/performance/noAwaitInLoops: the list is in one of a few files; stop at the first.
        const json = await fetchJson(`${SITE}/page-data/sq/d/${hash}.json`);
        const parsed = countryListSchema.safeParse(json);
        if (parsed.success) {
            return parsed.data.data.leaders.nodes.map((node) => node.country);
        }
    }
    throw new Error("CIA World Leaders: country index not found");
};

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

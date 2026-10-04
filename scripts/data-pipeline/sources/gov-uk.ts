import { readFile } from "node:fs/promises";

import { parse } from "csv-parse/sync";
import { z } from "zod";

import { mapWithConcurrency } from "../lib/collections";
import { fetchFile, fetchJson, withQuery } from "../lib/http";

/**
 * GOV.UK transparency data: every UK government department publishes its ministers' overseas
 * travel each quarter as CSV, under the Open Government Licence v3.0. Publications are found
 * through GOV.UK's search API and read through its content API.
 */

const SEARCH_API = "https://www.gov.uk/api/search.json";
const CONTENT_API = "https://www.gov.uk/api/content";
const SEARCH_QUERIES = [
    "ministerial overseas travel",
    "ministers gifts hospitality travel meetings",
    "ministerial travel and meetings",
];
const PAGE_SIZE = 1000;
const MAX_RESULTS = 6000;
const CONTENT_CONCURRENCY = 4;
const TRAVEL = /travel/i;
const MINISTERIAL = /minist/i;
/** Files about civil servants ("Senior officials' travel") are not ministers' travel. */
const NOT_MINISTERS = /senior officials?|special advis|permanent secretar|directors? general/i;

export const OGL_LICENCE_URL =
    "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/";

const searchSchema = z.object({
    results: z.array(z.object({ link: z.string(), title: z.string() })),
    total: z.number(),
});

const contentSchema = z.object({
    details: z
        .object({
            attachments: z
                .array(
                    z.object({
                        content_type: z.string().optional(),
                        title: z.string().optional(),
                        url: z.string().optional(),
                    })
                )
                .optional(),
        })
        .optional(),
    links: z
        .object({ organisations: z.array(z.object({ title: z.string() })).optional() })
        .optional(),
});

export interface UkTravelFile {
    csvUrl: string;
    /** Department that published it, e.g. "Foreign, Commonwealth & Development Office". */
    department: string;
    publicationUrl: string;
}

const searchPublications = async (): Promise<{ link: string; title: string }[]> => {
    const found = new Map<string, string>();
    for (const query of SEARCH_QUERIES) {
        for (let start = 0; start < MAX_RESULTS; start += PAGE_SIZE) {
            const url = withQuery(SEARCH_API, {
                count: String(PAGE_SIZE),
                fields: "link,title",
                filter_content_store_document_type: "transparency",
                q: query,
                start: String(start),
            });
            // biome-ignore lint/performance/noAwaitInLoops: pages follow one another; GOV.UK asks for gentle use.
            const page = searchSchema.parse(await fetchJson(url));
            for (const result of page.results) {
                if (TRAVEL.test(result.title) && MINISTERIAL.test(result.title)) {
                    found.set(result.link, result.title);
                }
            }
            if (start + PAGE_SIZE >= page.total) {
                break;
            }
        }
    }
    return [...found].map(([link, title]) => ({ link, title }));
};

/**
 * Finds every published CSV of ministers' overseas travel.
 *
 * @returns One entry per travel CSV, with the publishing department.
 */
export const fetchUkTravelFiles = async (): Promise<UkTravelFile[]> => {
    const publications = await searchPublications();
    const files = await mapWithConcurrency(publications, CONTENT_CONCURRENCY, async ({ link }) => {
        const content = contentSchema.parse(await fetchJson(`${CONTENT_API}${link}`));
        const department = content.links?.organisations?.[0]?.title ?? "UK Government";
        return (content.details?.attachments ?? []).flatMap((attachment): UkTravelFile[] => {
            const label = `${attachment.title ?? ""} ${attachment.url ?? ""}`;
            const isTravelCsv =
                attachment.content_type === "text/csv" &&
                attachment.url &&
                TRAVEL.test(label) &&
                !NOT_MINISTERS.test(label);
            return isTravelCsv && attachment.url
                ? [
                      {
                          csvUrl: attachment.url,
                          department,
                          publicationUrl: `https://www.gov.uk${link}`,
                      },
                  ]
                : [];
        });
    });
    return files.flat();
};

/** Files are UTF-8, except older ones saved from Excel in Windows-1252. */
const decode = (bytes: Uint8Array): string => {
    try {
        return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
        return new TextDecoder("windows-1252").decode(bytes);
    }
};

/**
 * Downloads and parses one CSV.
 *
 * @param url - CSV address.
 * @returns Rows as arrays of cells, header row included.
 */
export const fetchUkCsvRows = async (url: string): Promise<string[][]> => {
    const text = decode(await readFile(await fetchFile(url)));
    return parse(text, {
        bom: true,
        relax_column_count: true,
        relax_quotes: true,
        skip_empty_lines: true,
        trim: true,
    }) as string[][];
};

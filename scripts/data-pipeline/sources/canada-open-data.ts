import { createReadStream } from "node:fs";

import { parse } from "csv-parse";

import { PIPELINE_CONFIG } from "../config";
import { fetchFile } from "../lib/http";

/**
 * Government of Canada, "Proactive Disclosure – Travel Expenses": every federal institution
 * publishes its senior officials' and ministers' travel, consolidated into one CSV. Open
 * Government Licence – Canada.
 */

export const CANADA_DATASET_URL =
    "https://open.canada.ca/data/en/dataset/009f9a49-c2d9-4d29-a6d4-1a228da335ce";
const CSV_URL =
    "https://open.canada.ca/data/dataset/009f9a49-c2d9-4d29-a6d4-1a228da335ce/resource/8282db2a-878f-475c-af10-ad56aa8fa72c/download/travelq.csv";

export interface CanadaTravelRow {
    destinations: string[];
    endDate: string;
    name: string;
    /** Institution in English, e.g. "Global Affairs Canada". */
    organisation: string;
    purpose: string;
    startDate: string;
    title: string;
}

/**
 * Streams the consolidated CSV (about 70 MB, cached for a week) and keeps the rows that
 * `keep` accepts.
 *
 * @param keep - Filter applied to each row's title before it is stored.
 * @returns Matching rows.
 */
export const fetchCanadaTravelRows = async (
    keep: (title: string) => boolean
): Promise<CanadaTravelRow[]> => {
    const file = await fetchFile(CSV_URL, { ttlHours: PIPELINE_CONFIG.bulkCacheTtlHours });
    const rows: CanadaTravelRow[] = [];
    const parser = createReadStream(file).pipe(
        parse({
            bom: true,
            columns: true,
            relax_column_count: true,
            relax_quotes: true,
            trim: true,
        })
    );
    for await (const record of parser) {
        const row = record as Record<string, string | undefined>;
        const title = row.title_en ?? "";
        if (!keep(title)) {
            continue;
        }
        rows.push({
            destinations: [
                row.destination_en,
                row.destination_2_en,
                row.destination_other_en,
            ].filter((value): value is string => Boolean(value)),
            endDate: row.end_date ?? "",
            name: row.name ?? "",
            organisation: (row.owner_org_title ?? "").split("|")[0].trim(),
            purpose: row.purpose_en ?? "",
            startDate: row.start_date ?? "",
            title,
        });
    }
    return rows;
};

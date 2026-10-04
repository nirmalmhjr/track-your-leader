import ExcelJS from "exceljs";
import { z } from "zod";

import { PIPELINE_CONFIG } from "../config";
import { fetchFile, fetchJson } from "../lib/http";

/**
 * COLT — Country and Organization Leader Travel (Diplometrics, University of Denver), hosted
 * on Harvard Dataverse: foreign trips of heads of state and government of 200+ countries since
 * 1945, one row per trip and destination. Released under CC0 and updated about once a year.
 */

const DATAVERSE = "https://dataverse.harvard.edu";
const DATASET_DOI = "doi:10.7910/DVN/HJK7DN";
const TRAVEL_FILE = /Travel_Dataset.*\.xlsx$/i;

/** Citation link shown as each trip's source. */
export const COLT_DATASET_URL = "https://doi.org/10.7910/DVN/HJK7DN";

const datasetSchema = z.object({
    data: z.object({
        latestVersion: z.object({
            files: z.array(
                z.object({ dataFile: z.object({ filename: z.string(), id: z.number() }) })
            ),
        }),
    }),
});

/** The columns the pipeline reads, by their header text in the spreadsheet. */
const COLUMNS = {
    attendedEvent: "AttendedMultilatEvent",
    city: "CityVisited",
    endDate: "TripEndDate",
    eventName: "NameMultilatEvent",
    exiled: "Exiled",
    familyName: "LeaderSurname",
    fullName: "LeaderFullName",
    hostName: "HostHOGSName",
    leaderCountry: "LeaderCountryISO",
    metHost: "MetHostHoGS",
    ministerialEventName: "NameMultilatMinisterialEvent",
    publicAddress: "PublicAddress",
    role: "LeaderRole",
    signedAgreement: "SignedAgreement",
    startDate: "TripStartDate",
    title: "LeaderTitle",
    tripId: "TripID",
    visitedCountry: "CountryVisitedISO",
    year: "TripYear",
} as const;

export type ColtRow = Record<keyof typeof COLUMNS, string>;

/** Reads any spreadsheet cell value (plain, rich text, hyperlink, formula) as text. */
const cellText = (value: unknown): string => {
    if (value === null || value === undefined) {
        return "";
    }
    if (typeof value === "string" || typeof value === "number") {
        return String(value).trim();
    }
    if (value instanceof Date) {
        return value.toISOString().slice(0, 10);
    }
    if (typeof value === "object") {
        const cell = value as {
            richText?: { text: string }[];
            result?: unknown;
            text?: unknown;
        };
        if (cell.richText) {
            return cell.richText
                .map((part) => part.text)
                .join("")
                .trim();
        }
        if (cell.text !== undefined) {
            return cellText(cell.text);
        }
        if (cell.result !== undefined) {
            return cellText(cell.result);
        }
    }
    return "";
};

const downloadTravelFile = async (): Promise<string> => {
    const dataset = datasetSchema.parse(
        await fetchJson(
            `${DATAVERSE}/api/datasets/:persistentId/?persistentId=${encodeURIComponent(DATASET_DOI)}`
        )
    );
    const file = dataset.data.latestVersion.files.find((entry) =>
        TRAVEL_FILE.test(entry.dataFile.filename)
    );
    if (!file) {
        throw new Error("COLT: travel spreadsheet not found in the dataset");
    }
    return fetchFile(`${DATAVERSE}/api/access/datafile/${file.dataFile.id}`, {
        ttlHours: PIPELINE_CONFIG.bulkCacheTtlHours,
    });
};

/**
 * Downloads the latest COLT spreadsheet (cached for a week) and reads its trip rows. The sheet
 * is streamed: it holds about a million formatted rows, most of them empty.
 *
 * @returns One record per trip row, cells as text keyed by `COLUMNS`.
 */
export const fetchColtRows = async (): Promise<ColtRow[]> => {
    const path = await downloadTravelFile();
    const reader = new ExcelJS.stream.xlsx.WorkbookReader(path, {
        hyperlinks: "ignore",
        sharedStrings: "cache",
        styles: "ignore",
        worksheets: "emit",
    });

    const rows: ColtRow[] = [];
    for await (const worksheet of reader as AsyncIterable<AsyncIterable<ExcelJS.Row>>) {
        let columnIndex: Map<keyof typeof COLUMNS, number> | null = null;
        for await (const row of worksheet) {
            const values = (row.values as unknown[]).map(cellText);
            if (!columnIndex) {
                columnIndex = new Map(
                    (Object.entries(COLUMNS) as [keyof typeof COLUMNS, string][]).map(
                        ([key, header]) => [key, values.indexOf(header)]
                    )
                );
                continue;
            }
            const record = Object.fromEntries(
                [...columnIndex].map(([key, index]) => [
                    key,
                    index >= 0 ? (values[index] ?? "") : "",
                ])
            ) as ColtRow;
            if (record.tripId) {
                rows.push(record);
            }
        }
        // The trips are on the first sheet; the others hold codebook tables.
        break;
    }
    return rows;
};

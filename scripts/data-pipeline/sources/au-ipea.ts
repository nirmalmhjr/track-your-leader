import { createReadStream } from "node:fs";

import { parse } from "csv-parse";
import { z } from "zod";

import { fetchFile, fetchJson, withQuery } from "../lib/http";

/**
 * Australia's Independent Parliamentary Expenses Authority publishes every federal
 * parliamentarian's expenses each quarter on data.gov.au, including international travel
 * (parliamentary delegations and other official trips) with dates and destinations.
 * Creative Commons Attribution 3.0 Australia.
 */

const CKAN_SEARCH = "https://data.gov.au/data/api/3/action/package_search";
const SEARCH_QUERY = "Parliamentarians Expenditure";
const SEARCH_ROWS = "100";
/** Published quarters never change; a year-long cache spares the portal. */
const QUARTER_TTL_HOURS = 24 * 365;
const SEARCH_TTL_HOURS = 24 * 7;
const INTERNATIONAL = "International Travel";
const EXPENSES_FILE = /dataextract\.csv$/i;
export const IPEA_URL = "https://www.ipea.gov.au/reporting/transactions";

const searchSchema = z.object({
    result: z.object({
        results: z.array(
            z.object({
                resources: z.array(z.object({ name: z.string().nullable(), url: z.string() })),
                title: z.string(),
            })
        ),
    }),
});

export interface ParliamentarianTrip {
    endDate: string;
    firstName: string;
    fullNameWithTitle: string;
    reason: string;
    startDate: string;
    surname: string;
    /** "Japan, Singapore" */
    toLocation: string;
}

/** Every quarter's expenses file, from the portal's catalogue. */
const quarterFiles = async (): Promise<string[]> => {
    const json = await fetchJson(withQuery(CKAN_SEARCH, { q: SEARCH_QUERY, rows: SEARCH_ROWS }), {
        ttlHours: SEARCH_TTL_HOURS,
    });
    return searchSchema
        .parse(json)
        .result.results.filter((dataset) => dataset.title.includes("Parliamentarians"))
        .flatMap((dataset) => dataset.resources.map((resource) => resource.url))
        .filter((url) => EXPENSES_FILE.test(url));
};

/**
 * Every international trip in every quarter, one per traveller, dates and destinations (the
 * files list each fare, hotel and meal of a trip as its own row).
 *
 * @returns The trips.
 */
export const fetchParliamentarianTrips = async (): Promise<ParliamentarianTrip[]> => {
    const trips = new Map<string, ParliamentarianTrip>();
    for (const url of await quarterFiles()) {
        // biome-ignore lint/performance/noAwaitInLoops: one quarter at a time keeps memory low.
        const file = await fetchFile(url, { ttlHours: QUARTER_TTL_HOURS });
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
            if (row.HighLevelCategory !== INTERNATIONAL || !row.FromDate || !row.ToLocation) {
                continue;
            }
            const trip: ParliamentarianTrip = {
                endDate: row.ToDate || row.FromDate,
                firstName: row.FirstName ?? "",
                fullNameWithTitle: row.FullNameWithTitle ?? "",
                reason: row.ReasonForTravel ?? "",
                startDate: row.FromDate,
                surname: row.Surname ?? "",
                toLocation: row.ToLocation,
            };
            trips.set(
                `${trip.firstName}|${trip.surname}|${trip.startDate}|${trip.toLocation}`,
                trip
            );
        }
    }
    return [...trips.values()];
};

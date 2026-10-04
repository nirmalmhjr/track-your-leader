import { load } from "cheerio";
import { z } from "zod";

import { mapWithConcurrency } from "../lib/collections";
import { fetchJson, fetchText } from "../lib/http";
import { cleanText } from "../lib/text";

/**
 * US Department of State, Office of the Historian: every foreign trip of US presidents and
 * secretaries of state, from the source repository behind history.state.gov/departmenthistory/
 * travels. A US government work in the public domain (CC0). It lags about a year behind.
 */

const REPOSITORY = "HistoryAtState/travels";
const FOLDERS = { president: "president-travels", secretary: "secretary-travels" } as const;
const FILE_CONCURRENCY = 4;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type HistorianRole = keyof typeof FOLDERS;

export interface HistorianTrip {
    country: string;
    endDate: string;
    locale: string;
    name: string;
    remarks: string;
    role: HistorianRole;
    startDate: string;
    /** Person slug, e.g. `blinken-antony-j`. */
    who: string;
}

const contentsSchema = z.array(z.object({ name: z.string(), type: z.string() }));

/**
 * Public page listing one person's trips.
 *
 * @param trip - Any trip of the person.
 * @returns The page URL.
 */
export const historianPageUrl = (trip: Pick<HistorianTrip, "role" | "who">): string =>
    `https://history.state.gov/departmenthistory/travels/${trip.role}/${trip.who}`;

const parseTrips = (xml: string, role: HistorianRole): HistorianTrip[] => {
    const $ = load(xml, { xml: true });
    return $("trip")
        .toArray()
        .flatMap((element): HistorianTrip[] => {
            const trip = $(element);
            const text = (tag: string): string => cleanText(trip.children(tag).first().text());
            const startDate = text("start-date");
            const endDate = text("end-date") || startDate;
            if (!(ISO_DATE.test(startDate) && ISO_DATE.test(endDate))) {
                return [];
            }
            return [
                {
                    country: text("country"),
                    endDate,
                    locale: text("locale"),
                    name: text("name"),
                    remarks: text("remarks"),
                    role,
                    startDate,
                    who: trip.attr("who") ?? "",
                },
            ];
        });
};

/**
 * Downloads every president's and secretary of state's travel file.
 *
 * @returns All trips, one per row (a multi-city trip has a row per city).
 */
export const fetchHistorianTrips = async (): Promise<HistorianTrip[]> => {
    const files = (
        await Promise.all(
            (Object.entries(FOLDERS) as [HistorianRole, string][]).map(async ([role, folder]) =>
                contentsSchema
                    .parse(
                        await fetchJson(
                            `https://api.github.com/repos/${REPOSITORY}/contents/${folder}`
                        )
                    )
                    .filter((entry) => entry.type === "file" && entry.name.endsWith(".xml"))
                    .map((entry) => ({ folder, name: entry.name, role }))
            )
        )
    ).flat();

    const trips = await mapWithConcurrency(
        files,
        FILE_CONCURRENCY,
        async ({ folder, name, role }) =>
            parseTrips(
                await fetchText(
                    `https://raw.githubusercontent.com/${REPOSITORY}/master/${folder}/${name}`
                ),
                role
            )
    );
    return trips.flat();
};

import { load } from "cheerio";
import { z } from "zod";

import { mapWithConcurrency } from "../lib/collections";
import { fetchJson, fetchText } from "../lib/http";
import { cleanText } from "../lib/text";

/**
 * US Department of State, Office of the Historian: every visit to the United States by a
 * foreign head of state or government (and some foreign ministers) since 1874, from the source
 * repository behind history.state.gov/departmenthistory/visits. Public domain (CC0). Being
 * hosted by one country, it still covers the leaders of every country, kings and emperors
 * included, back to the 1940s.
 */

const REPOSITORY = "HistoryAtState/visits";
const FOLDER = "data";
const FILE_CONCURRENCY = 4;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const HISTORIAN_VISITS_URL = "https://history.state.gov/departmenthistory/visits";

export interface HistorianVisit {
    description: string;
    endDate: string;
    /** Visiting country as written ("Yemen Arab Republic"). */
    from: string;
    /** The source's country slug ("yemen"). */
    fromId: string;
    id: string;
    startDate: string;
    /** Title and name, e.g. "Prime Minister Anibal Antonio Cavaco e Silva". */
    visitors: string[];
}

const contentsSchema = z.array(z.object({ name: z.string(), type: z.string() }));

/**
 * Reads one decade file.
 *
 * @param xml - File contents.
 * @returns Its visits with complete dates.
 */
export const parseHistorianVisits = (xml: string): HistorianVisit[] => {
    const $ = load(xml, { xml: true });
    return $("visit")
        .toArray()
        .flatMap((element): HistorianVisit[] => {
            const visit = $(element);
            const text = (tag: string): string => cleanText(visit.children(tag).first().text());
            const startDate = text("start-date");
            const endDate = text("end-date") || startDate;
            if (!(ISO_DATE.test(startDate) && ISO_DATE.test(endDate))) {
                return [];
            }
            const from = visit.children("from").first();
            return [
                {
                    description: text("description"),
                    endDate,
                    from: cleanText(from.text()),
                    fromId: from.attr("id") ?? "",
                    id: text("id"),
                    startDate,
                    visitors: visit
                        .children("visitor")
                        .toArray()
                        .map((visitor) => cleanText($(visitor).text()))
                        .filter(Boolean),
                },
            ];
        });
};

/**
 * Downloads every decade file.
 *
 * @returns All visits, oldest first.
 */
export const fetchHistorianVisits = async (): Promise<HistorianVisit[]> => {
    const files = contentsSchema
        .parse(await fetchJson(`https://api.github.com/repos/${REPOSITORY}/contents/${FOLDER}`))
        .filter((entry) => entry.type === "file" && entry.name.endsWith(".xml"))
        .map((entry) => entry.name)
        .sort();

    const visits = await mapWithConcurrency(files, FILE_CONCURRENCY, async (name) =>
        parseHistorianVisits(
            await fetchText(
                `https://raw.githubusercontent.com/${REPOSITORY}/master/${FOLDER}/${name}`
            )
        )
    );
    return visits.flat();
};

import { type CheerioAPI, load } from "cheerio";
import type { Element } from "domhandler";

import { fetchText } from "../lib/http";
import { cleanText } from "../lib/text";

/**
 * The Danish Royal House's list of state and official visits since 1972 (kongehuset.dk): state
 * visits to and from Denmark by year ("2024 Norge", "2026 Den Socialistiske Republik Vietnam
 * (19.-21. oktober)"), and official visits abroad with who travelled ("H.M. Kongen", "Kenya
 * (10.-11. december)"). Only facts are kept (who, where, when), linked to the page.
 */

export const DANISH_COURT_URL =
    "https://www.kongehuset.dk/monarkiet-i-danmark/stats-og-officielle-besog";

export type DanishVisitKind = "incoming" | "official" | "outgoing";

export interface DanishVisit {
    /** Day and month as written ("19.-21. oktober"), or `null` when only the year is given. */
    dates: string | null;
    kind: DanishVisitKind;
    /** Who travelled, for official visits ("H.M. Kongen (daværende kronprins)"). */
    person: string | null;
    /** Countries or places as written ("Tanzania og Mexico", "Rom, Italien"). */
    places: string;
    year: number;
}

const SECTION_KIND: readonly (readonly [RegExp, DanishVisitKind])[] = [
    [/indgående statsbesøg/i, "incoming"],
    [/udgående statsbesøg/i, "outgoing"],
    [/besøg i udlandet/i, "official"],
];
/** "2008 Tanzania og Mexico", "2024 Island (8.-9. oktober)". */
const YEAR_LINE = /^((?:19|20)\d{2})\s+(.+?)(?:\s*\(([^)]*)\))?$/;
const YEAR = /^(?:19|20)\d{2}$/;
/** "Kenya (10.-11. december)". */
const PLACE_LINE = /^(.+?)(?:\s*\(([^)]*)\))?$/;
/** Parenthesised notes that aren't dates ("tiltrædelsesbesøg", "festbesøg"). */
const HAS_DIGIT = /\d/;

const datesIn = (text: string | undefined): string | null =>
    text && HAS_DIGIT.test(text) ? cleanText(text) : null;

/** The lines of a paragraph, after its year (bold) and person (italics) are taken off. */
const linesOf = ($: CheerioAPI, paragraph: Element): string[] => {
    $(paragraph).find("br").replaceWith("\n");
    $(paragraph).find("strong, em").remove();
    return $(paragraph)
        .text()
        .split("\n")
        .map((line) => cleanText(line))
        .filter(Boolean);
};

interface Current {
    person: string | null;
    year: number | null;
}

/** One line: "2008 Tanzania og Mexico", or, for official visits, "Kenya (10.-11. december)". */
const readLine = (line: string, kind: DanishVisitKind, current: Current): DanishVisit | null => {
    if (kind !== "official") {
        const dated = line.match(YEAR_LINE);
        return dated
            ? {
                  dates: datesIn(dated[3]),
                  kind,
                  person: null,
                  places: cleanText(dated[2] ?? ""),
                  year: Number(dated[1]),
              }
            : null;
    }
    if (current.year === null) {
        return null;
    }
    const [, places = line, dates] = line.match(PLACE_LINE) ?? [];
    return {
        dates: datesIn(dates),
        kind,
        person: current.person,
        places: cleanText(places),
        year: current.year,
    };
};

/**
 * Reads the page's three lists.
 *
 * @param html - The page.
 * @returns Every visit listed.
 */
export const parseDanishVisits = (html: string): DanishVisit[] => {
    const $ = load(html);
    const visits: DanishVisit[] = [];
    for (const item of $(".accordion__container__item").toArray()) {
        const title = cleanText($(item).find(".accordion__container__item__title").first().text());
        const kind = SECTION_KIND.find(([pattern]) => pattern.test(title))?.[1];
        if (!kind) {
            continue;
        }
        // Official visits give the year once (bold) and who went (italics) before their places.
        const current: Current = { person: null, year: null };
        for (const paragraph of $(item).find(".accordion__container__item__content p").toArray()) {
            const strong = cleanText($(paragraph).find("strong").first().text());
            const em = cleanText($(paragraph).find("em").first().text());
            current.year = YEAR.test(strong) ? Number(strong) : current.year;
            current.person = em || current.person;
            visits.push(
                ...linesOf($, paragraph).flatMap((line) => readLine(line, kind, current) ?? [])
            );
        }
    }
    return visits;
};

/**
 * Every visit on the Royal House's list.
 *
 * @returns The visits.
 */
export const fetchDanishVisits = async (): Promise<DanishVisit[]> =>
    parseDanishVisits(await fetchText(DANISH_COURT_URL));

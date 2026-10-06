import { type CheerioAPI, load } from "cheerio";
import type { Element } from "domhandler";

import type { CountryCode } from "@/types/geo.types";
import type { Place } from "@/types/travel.types";

import { PIPELINE_CONFIG } from "../../config";
import { todayIso } from "../../lib/dates";
import { cleanText, normalizeName } from "../../lib/text";
import { fetchHumans } from "../../sources/wikidata";
import {
    fetchArticleHtml,
    fetchWikidataIds,
    searchAllTitles,
    wikipediaUrl,
} from "../../sources/wikipedia";
import type { SkippedRow, TripClaim } from "../../types";
import { countryCodeOfName, countryPlace, type PlaceIndex } from "../places.resolve";
import { classifyTitle } from "../roles";
import { parseTripDates, type TripDates } from "../trip-dates.parse";
import { classifyTripType } from "../trip-type.classify";

/**
 * Wikipedia's "<country>–<country> relations" articles: about a thousand of them list the
 * high-level visits between the two countries under headings such as "High-level visits from
 * Argentina to New Zealand", one visitor per line ("President Carlos Menem (1998)"). They cover
 * pairs of small countries that no other source does, back to the 1950s. Only these lists and
 * tables are read; visits told in running prose are left alone. CC BY-SA.
 */

const SEARCHES = [
    'intitle:relations "high-level visits"',
    'intitle:relations "high level visits"',
    'intitle:relations "state visits"',
    'intitle:relations "official visits"',
    'intitle:relations "visits from"',
] as const;
const RELATIONS_TITLE = /^(.+?)\s*[–-]\s*(.+?) relations$/;
/** "High-level visits from Latvia to Canada", "Visits by leaders from Brazil to Tanzania". */
const FROM_TO = /\bvisits?\b.*?\bfrom\s+(?:the\s+)?(.+?)\s+to\s+(?:the\s+)?(.+?)$/i;
/** "Tanzania High Level Visits to India", "Indian visits to Tanzania". */
const COUNTRY_VISITS_TO =
    /^(?:the\s+)?(.+?)(?:'s)?\s+(?:high[- ]level\s+|state\s+|official\s+|presidential\s+|ministerial\s+)?visits?\s+to\s+(?:the\s+)?(.+?)$/i;
const CITATIONS = /\[[^\]]*\]/g;
const EDIT_LINK = /\[edit\]/gi;
/** A short paragraph standing in for a heading ("High-level visits from Brazil to Tanzania[1]"). */
const MAX_HEADING_LENGTH = 90;
const WIKI_LINK = "/wiki/";
const NON_ARTICLE = /^(file|image|help|wikipedia|category|template|portal|special):/i;
const OFFICE_LINK =
    /\b(president|prime minister|minister|chancellor|head of|king of|queen of|emir of|sultan of|monarch|premier|government|council|list of|secretary|governor|parliament|assembly|ministry|embassy|summit|visit)\b/i;
const FIRST_YEAR = String(PIPELINE_CONFIG.warehouseSinceYear);
const TRIM_PUNCTUATION = /^[\s,:;–—-]+|[\s,:;–—-]+$/g;
const PARENTHESES = /\([^)]*\)/g;
const DIGITS = /\d+/g;
const HEADING_TAG = /^h[2-4]$/;

interface PageLink {
    text: string;
    title: string;
}

/** One of the two countries a relations page is about, as its title names it. */
export interface PageCountry {
    code: CountryCode;
    name: string;
}

/** Letters a demonym shares with its country's name ("Indian", "India"). */
const DEMONYM_STEM = 4;

/** One listed visit: who (by link), when, and which way. */
export interface RelationsVisit {
    dates: TripDates;
    from: CountryCode;
    links: PageLink[];
    text: string;
    to: CountryCode;
}

const linksOf = ($: CheerioAPI, element: Element): PageLink[] =>
    $(element)
        .find(`a[href^='${WIKI_LINK}']`)
        .toArray()
        .flatMap((anchor) => {
            const href = $(anchor).attr("href") ?? "";
            const title = decodeURIComponent(href.slice(WIKI_LINK.length).split("#")[0]).replaceAll(
                "_",
                " "
            );
            const text = cleanText($(anchor).text());
            return title && text && !NON_ARTICLE.test(title) ? [{ text, title }] : [];
        });

/** A country of the pair, named or described ("Indian visits to Tanzania"). */
const countryOfPair = (words: string, pair: readonly PageCountry[]): CountryCode | null => {
    const named = countryCodeOfName(words);
    if (named) {
        return pair.some(({ code }) => code === named) ? named : null;
    }
    const lower = normalizeName(words);
    return (
        pair.find(({ name }) => {
            const stem = normalizeName(name).slice(0, DEMONYM_STEM);
            return stem.length === DEMONYM_STEM && lower.startsWith(stem);
        })?.code ?? null
    );
};

/**
 * Reads which way a heading's visits go, between the page's two countries.
 *
 * @param heading - Heading text.
 * @param pair - The page's two countries.
 * @returns Origin and destination, or `null` when the heading doesn't say.
 */
export const directionOf = (
    heading: string,
    pair: readonly PageCountry[]
): { from: CountryCode; to: CountryCode } | null => {
    const text = cleanText(heading.replace(EDIT_LINK, "").replace(CITATIONS, ""));
    const match = text.match(FROM_TO) ?? text.match(COUNTRY_VISITS_TO);
    if (!match) {
        return null;
    }
    const from = countryOfPair(match[1], pair);
    const to = countryOfPair(match[2], pair);
    return from && to && from !== to ? { from, to } : null;
};

const isHeading = ($: CheerioAPI, element: Element): boolean =>
    HEADING_TAG.test(element.tagName) || $(element).hasClass("mw-heading");

/**
 * Reads the listed visits of a relations page: list items and table rows under a heading (or a
 * short heading-like paragraph) that says which way the visits go.
 *
 * @param html - Rendered article HTML.
 * @param pair - The page's two countries.
 * @returns The visits with a year or better.
 */
export const parseRelationsPage = (
    html: string,
    pair: readonly PageCountry[]
): RelationsVisit[] => {
    const $ = load(html);
    const root = $(".mw-parser-output").first();
    const blocks = (root.length > 0 ? root : $("body")).children().toArray();
    const visits: RelationsVisit[] = [];
    let direction: { from: CountryCode; to: CountryCode } | null = null;

    for (const block of blocks) {
        const text = cleanText($(block).text());
        if (isHeading($, block)) {
            direction = directionOf(text, pair);
            continue;
        }
        if (block.tagName === "p" && text.length <= MAX_HEADING_LENGTH) {
            direction = directionOf(text, pair) ?? direction;
            continue;
        }
        if (!direction) {
            continue;
        }
        const rows = $(block)
            .find("li, tr")
            .addBack("li, tr")
            .toArray()
            .filter((row): row is Element => row.type === "tag" && $(row).find("li").length === 0);
        for (const row of rows) {
            const rowText = cleanText($(row).text().replace(CITATIONS, " "));
            const dates = parseTripDates(rowText, null);
            if (dates) {
                visits.push({ dates, ...direction, links: linksOf($, row), text: rowText });
            }
        }
    }
    return visits;
};

/**
 * The visitor of a listed visit: the first linked person, and the office written before or
 * after the name ("Foreign Minister Bernard Membe (2010)").
 */
const visitorOf = (
    visit: RelationsVisit,
    isPerson: (link: PageLink) => boolean
): { person: PageLink; role: string } | null => {
    const person = visit.links.find((link) => !OFFICE_LINK.test(link.title) && isPerson(link));
    if (!person) {
        return null;
    }
    const role = cleanText(
        visit.text.replace(person.text, " ").replace(PARENTHESES, " ").replace(DIGITS, " ")
    ).replace(TRIM_PUNCTUATION, "");
    return { person, role };
};

/** Every relations article that mentions visits, with its two countries. */
const findRelationsPages = async (): Promise<{ pair: PageCountry[]; title: string }[]> => {
    const titles = new Set<string>();
    for (const search of SEARCHES) {
        for (const title of await searchAllTitles(search)) {
            if (RELATIONS_TITLE.test(title)) {
                titles.add(title);
            }
        }
    }
    return [...titles].sort().flatMap((title) => {
        const [, first = "", second = ""] = title.match(RELATIONS_TITLE) ?? [];
        const a = countryCodeOfName(first);
        const b = countryCodeOfName(second);
        return a && b && a !== b
            ? [
                  {
                      pair: [
                          { code: a, name: first },
                          { code: b, name: second },
                      ],
                      title,
                  },
              ]
            : [];
    });
};

const claimOf = (
    visit: RelationsVisit,
    visitor: { person: PageLink; role: string },
    context: { destination: Place; title: string; wikidataId: string | null }
): TripClaim => {
    const office = classifyTitle(visitor.role);
    return {
        datePrecision: visit.dates.precision,
        destination: context.destination,
        endDate: visit.dates.endDate,
        engagements: [],
        eventName: null,
        purpose: null,
        source: "relations",
        sourceRef: { label: "Wikipedia", url: wikipediaUrl(context.title) },
        startDate: visit.dates.startDate,
        statusHint: null,
        traveller: {
            categories: office.categories[0] === "senior_official" ? [] : office.categories,
            countryCode: visit.from,
            familyName: null,
            name: visitor.person.text,
            portfolio: office.portfolio,
            title: visitor.role || null,
            wikidataId: context.wikidataId,
        },
        type: classifyTripType(visit.text),
    };
};

/**
 * Every listed high-level visit on Wikipedia's relations articles, as trips to the other
 * country (country precision: the lists rarely name the city).
 *
 * @param places - Place index.
 * @returns One claim per visit with a linked visitor, and what couldn't be used.
 */
export const extractRelationsClaims = async (
    places: PlaceIndex
): Promise<{ claims: TripClaim[]; skipped: SkippedRow[] }> => {
    const pages = await findRelationsPages();
    const articles = await Promise.all(pages.map(({ title }) => fetchArticleHtml(title)));
    const read = pages.flatMap(({ pair, title }, index) => {
        const article = articles[index];
        return article ? [{ title, visits: parseRelationsPage(article.html, pair) }] : [];
    });

    const itemByTitle = await fetchWikidataIds(
        read.flatMap(({ visits }) => visits.flatMap(({ links }) => links.map((link) => link.title)))
    );
    const humans = await fetchHumans([...itemByTitle.values()]);
    const isPerson = (link: PageLink): boolean => humans.has(itemByTitle.get(link.title) ?? "");
    const today = todayIso();

    const claims: TripClaim[] = [];
    const skipped: SkippedRow[] = [];
    for (const { title, visits } of read) {
        for (const visit of visits) {
            const visitor = visitorOf(visit, isPerson);
            const destination = countryPlace(places, visit.to);
            const isInRange = visit.dates.startDate >= FIRST_YEAR && visit.dates.startDate <= today;
            if (!visitor) {
                skipped.push({ reason: "no linked visitor", text: visit.text });
            } else if (destination && isInRange) {
                claims.push(
                    claimOf(visit, visitor, {
                        destination,
                        title,
                        wikidataId: itemByTitle.get(visitor.person.title) ?? null,
                    })
                );
            }
        }
    }
    return { claims, skipped };
};

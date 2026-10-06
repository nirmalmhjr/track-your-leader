import { type CheerioAPI, load } from "cheerio";
import type { Element } from "domhandler";

import type { CountryCode } from "@/types/geo.types";
import type { Place } from "@/types/travel.types";

import { PIPELINE_CONFIG } from "../../config";
import { todayIso } from "../../lib/dates";
import { cleanText } from "../../lib/text";
import { fetchHumans } from "../../sources/wikidata";
import {
    fetchArticleHtml,
    fetchWikidataIds,
    searchTitles,
    wikipediaUrl,
} from "../../sources/wikipedia";
import type { SkippedRow, TripClaim } from "../../types";
import {
    type CityLookup,
    countryCodeOfName,
    countryPlace,
    type PlaceIndex,
} from "../places.resolve";
import { classifyTitle } from "../roles";
import { parseTripDates, type TripDates } from "../trip-dates.parse";

/**
 * Summit attendance from Wikipedia: the page of each Non-Aligned Movement summit, Commonwealth
 * meeting, Arab League summit, G7/G20, BRICS, SCO, SAARC, ASEAN, APEC, Summit of the Americas,
 * NATO, Islamic and other summits lists the leaders who attended, each with a flag, a link to
 * their country and a link to their article. Each attendee becomes a trip to the host city on
 * the summit's dates. Small and developing countries attend these often, so they fill history
 * that bilateral sources miss. CC BY-SA.
 */

/** Search queries, one per summit family; pages without an attendee list yield nothing. */
const SUMMIT_SEARCHES = [
    'intitle:"Summit of the Non-Aligned Movement"',
    'intitle:"Commonwealth Heads of Government Meeting"',
    'intitle:"Arab League summit"',
    'intitle:"G20" intitle:"summit"',
    'intitle:"G7 summit"',
    'intitle:"G8 summit"',
    'intitle:"BRICS summit"',
    'intitle:"SCO summit"',
    'intitle:"SAARC summit"',
    'intitle:"ASEAN Summit"',
    'intitle:"East Asia Summit"',
    'intitle:"APEC"',
    'intitle:"Summit of the Americas"',
    'intitle:"NATO summit"',
    'intitle:"Islamic Summit"',
    'intitle:"CELAC summit"',
    'intitle:"Pacific Islands Forum"',
    'intitle:"Organization of Turkic States summit"',
    'intitle:"European Union–African Union Summit"',
] as const;
const SEARCH_LIMIT = 500;
const FIRST_YEAR = String(PIPELINE_CONFIG.warehouseSinceYear);
const YEAR = /\b(?:19|20)\d{2}\b/;
const PARENTHESES = /\([^)]*\)/g;
const WIKI_LINK = "/wiki/";
const NON_ARTICLE = /^(file|image|help|wikipedia|category|template|portal|special):/i;
/** Links to offices, lists or governments rather than people ("Prime Minister of Burma"). */
const OFFICE_LINK =
    /\b(president|prime minister|minister|chancellor|chief of state|head of|king of|queen of|emir of|sultan of|monarch|premier|government|council|list of|secretary|governor)\b/i;
/** Envoys based in the host city attend without travelling. */
const RESIDENT_ENVOY =
    /ambassador|permanent representative|chargé|charge d'affaires|high commissioner/i;
const TRIM_PUNCTUATION = /^[\s,:;–—-]+|[\s,:;–—-]+$/g;
const DATE_LABEL = /^dates?$/i;
/**
 * A date range anywhere in the infobox, for pages that give it in the navigation row
 * ("← 9th 25–27 July 2018 11th →"): "25–27 July 2018", "May 4–6, 1986".
 */
const INFOBOX_DATES =
    /\b\d{1,2}(?:\s*[–-]\s*\d{1,2})?\s+[A-Z][a-z]+(?:\s*[–-]\s*\d{1,2}\s+[A-Z][a-z]+)?\s+(?:19|20)\d{2}\b|\b[A-Z][a-z]+\s+\d{1,2}(?:\s*[–-]\s*\d{1,2})?,\s+(?:19|20)\d{2}\b/;
const HOST_LABEL = /^host( country| nation)?$|^country$/i;
const CITY_LABEL = /^(cit(y|ies)|venues?|location|host city)$/i;
const VIRTUAL = /\b(virtual(ly)?|video ?conferenc\w*|held online|online format)\b/i;
/** Paragraphs read for the "held by video" check: the opening ones describe the format. */
const LEAD_PARAGRAPHS = 2;
/** Infobox rows about the neighbouring summits ("Precedes: 2022 NATO virtual summit"). */
const NEIGHBOUR_ROW = /^(follows|precedes|preceded by|followed by)$|[←→]/i;

interface PageLink {
    text: string;
    title: string;
}

/** A row listing an attendee, before its links are told apart. */
export interface SummitRow {
    /** Country named by the row's flag image ("Flag_of_Nepal.svg"), if any. */
    flag: string | null;
    links: PageLink[];
    text: string;
}

export interface SummitAttendee {
    countryCode: CountryCode;
    person: PageLink;
    /** Office as written beside the name ("Prime Minister of Afghanistan"). */
    role: string;
}

export interface SummitPage {
    /** Host city as linked in the infobox. */
    city: string | null;
    dates: TripDates | null;
    host: string | null;
    /** Held by video (the 2020 G20, BRICS and SCO summits): nobody travelled. */
    isVirtual: boolean;
    rows: SummitRow[];
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

/** The infobox text, without the rows naming the previous and next summits. */
const ownInfoboxText = ($: CheerioAPI): string =>
    $("table.infobox")
        .first()
        .find("tr")
        .toArray()
        .filter((row) => !NEIGHBOUR_ROW.test(cleanText($(row).children("th").first().text())))
        .map((row) => cleanText($(row).text()))
        .filter((text) => !NEIGHBOUR_ROW.test(text))
        .join(" ");

/** The infobox cell next to a label matching `label`. */
const infoboxCell = ($: CheerioAPI, label: RegExp): Element | undefined =>
    $("table.infobox tr")
        .toArray()
        .find((row) => label.test(cleanText($(row).children("th").first().text())))
        ?.children.find(
            (child): child is Element => child.type === "tag" && child.tagName === "td"
        );

const FLAG_FILE = /Flag_of_(.+?)(?:_\(\d.*\))?\.svg/i;

const flagCountry = ($: CheerioAPI, row: Element): string | null => {
    const source = $(row).find(".flagicon img").first().attr("src") ?? "";
    const name = decodeURIComponent(source).match(FLAG_FILE)?.[1];
    return name ? name.replaceAll("_", " ") : null;
};

interface AttendeeLookups {
    /** Country of a link to a country's article, if it is one. */
    countryOf: (link: PageLink) => CountryCode | null;
    /** Whether a link points to a person's article. */
    isPerson: (link: PageLink) => boolean;
}

/**
 * Tells a row's links apart: the first link to a country (or the flag's country) and the first
 * link to a person. Rows naming only a country don't say who went, so they give nobody.
 *
 * @param row - Row read from the page.
 * @param lookups - What each linked article is.
 * @returns The attendee, or `null`.
 */
export const resolveAttendee = (
    row: SummitRow,
    { countryOf, isPerson }: AttendeeLookups
): SummitAttendee | null => {
    const countryLink = row.links.find((link) => countryOf(link) !== null);
    const countryCode =
        (countryLink ? countryOf(countryLink) : null) ??
        (row.flag ? countryCodeOfName(row.flag) : null);
    const person = row.links.find((link) => !OFFICE_LINK.test(link.title) && isPerson(link));
    if (!(countryCode && person)) {
        return null;
    }
    const role = cleanText(
        row.text
            .replace(countryLink?.text ?? "", " ")
            .replace(person.text, " ")
            .replace(PARENTHESES, " ")
    ).replace(TRIM_PUNCTUATION, "");
    return { countryCode, person, role };
};

/**
 * Reads a summit page: dates, host and the rows listed with flags (outside the infobox and
 * navigation boxes).
 *
 * @param html - Rendered article HTML.
 * @param title - Page title, whose year helps dates written without one.
 * @returns The summit's details and flagged rows.
 */
export const parseSummitPage = (html: string, title: string): SummitPage => {
    const $ = load(html);
    const cellText = (label: RegExp): string => {
        const cell = infoboxCell($, label);
        return cell ? cleanText($(cell).text()) : "";
    };
    const cellLink = (label: RegExp): string | null => {
        const cell = infoboxCell($, label);
        return cell ? (linksOf($, cell)[0]?.text ?? null) : null;
    };
    const dateText =
        cellText(DATE_LABEL).replace(PARENTHESES, " ") ||
        (cleanText($("table.infobox").first().find("td").text()).match(INFOBOX_DATES)?.[0] ?? "");
    const year = Number((title.match(YEAR) ?? dateText.match(YEAR))?.[0]) || null;

    const rows = $("li, tr")
        .toArray()
        .filter(
            (row) =>
                $(row).find(".flagicon").length > 0 &&
                $(row).closest("table.infobox, .navbox, .sidebar, .vertical-navbox").length === 0
        )
        .map((row) => ({
            flag: flagCountry($, row),
            links: linksOf($, row),
            text: cleanText($(row).text()),
        }));
    const lead = $("p")
        .toArray()
        .filter((paragraph) => $(paragraph).closest("table").length === 0)
        .slice(0, LEAD_PARAGRAPHS)
        .map((paragraph) => $(paragraph).text())
        .join(" ");
    return {
        city: cellLink(CITY_LABEL),
        dates: parseTripDates(dateText, year),
        host: cellLink(HOST_LABEL) ?? (cellText(HOST_LABEL) || null),
        isVirtual: VIRTUAL.test(`${ownInfoboxText($)} ${lead}`),
        rows,
    };
};

interface SummitInput {
    cities: CityLookup;
    places: PlaceIndex;
}

interface Summit extends SummitPage {
    dates: TripDates;
    host: CountryCode;
    title: string;
}

/** Every page title the summit searches find. */
const findSummitTitles = async (): Promise<string[]> => {
    const titles = new Set<string>();
    for (const search of SUMMIT_SEARCHES) {
        for (const title of await searchTitles(search, "en", SEARCH_LIMIT)) {
            titles.add(title);
        }
    }
    return [...titles].sort();
};

/** Reads each page; those with flagged rows, dates and a host become summits. */
const readSummits = async (
    titles: readonly string[],
    cities: CityLookup,
    skipped: SkippedRow[]
): Promise<Summit[]> => {
    const articles = await Promise.all(titles.map((title) => fetchArticleHtml(title)));
    const summits = titles.flatMap((title, index): Summit[] => {
        const article = articles[index];
        const page = article ? parseSummitPage(article.html, title) : null;
        if (!page || page.rows.length === 0) {
            return [];
        }
        if (page.isVirtual) {
            skipped.push({ reason: "held online", text: title });
            return [];
        }
        const host = page.host ? countryCodeOfName(page.host) : null;
        if (!(page.dates && host)) {
            skipped.push({ reason: "summit date or host not found", text: title });
            return [];
        }
        if (page.city) {
            cities.request(host, page.city);
        }
        return [{ ...page, dates: page.dates, host, title }];
    });
    await cities.load();
    return summits;
};

const claimOf = (
    summit: Summit,
    destination: Place,
    { countryCode, person, role }: SummitAttendee,
    wikidataId: string | null
): TripClaim => {
    const office = classifyTitle(role);
    return {
        datePrecision: summit.dates.precision,
        destination,
        endDate: summit.dates.endDate,
        engagements: [],
        eventName: summit.title,
        purpose: `Attended the ${summit.title}`,
        source: "summits",
        sourceRef: { label: "Wikipedia", url: wikipediaUrl(summit.title) },
        startDate: summit.dates.startDate,
        statusHint: summit.dates.startDate > todayIso() ? "planned" : null,
        traveller: {
            categories: office.categories[0] === "senior_official" ? [] : office.categories,
            countryCode,
            familyName: null,
            name: person.text,
            portfolio: office.portfolio,
            title: role || null,
            wikidataId,
        },
        type: "summit",
    };
};

/**
 * Every listed attendee of every summit page found, as trips to the host city.
 *
 * @returns One claim per attendee from abroad, and what couldn't be used.
 */
export const extractSummitClaims = async ({
    cities,
    places,
}: SummitInput): Promise<{ claims: TripClaim[]; skipped: SkippedRow[] }> => {
    const skipped: SkippedRow[] = [];
    const summits = await readSummits(await findSummitTitles(), cities, skipped);

    const itemByTitle = await fetchWikidataIds(
        summits.flatMap(({ rows }) => rows.flatMap(({ links }) => links.map((link) => link.title)))
    );
    const humans = await fetchHumans([...itemByTitle.values()]);
    const lookups: AttendeeLookups = {
        countryOf: (link) => {
            const item = itemByTitle.get(link.title);
            return (
                (item ? places.codeByItem.get(item) : undefined) ?? countryCodeOfName(link.title)
            );
        },
        isPerson: (link) => humans.has(itemByTitle.get(link.title) ?? ""),
    };

    const claims: TripClaim[] = [];
    for (const summit of summits.filter(({ dates }) => dates.startDate >= FIRST_YEAR)) {
        const destination =
            (summit.city ? cities.place(summit.host, summit.city) : null) ??
            countryPlace(places, summit.host);
        if (!destination) {
            skipped.push({ reason: "summit place not found", text: summit.title });
            continue;
        }
        // A person listed twice (a table and a gallery) counts once.
        const seen = new Set<string>();
        for (const row of summit.rows) {
            const attendee = resolveAttendee(row, lookups);
            if (!attendee) {
                skipped.push({ reason: "no linked person and country", text: row.text });
                continue;
            }
            const { countryCode, person, role } = attendee;
            const isAbroad = countryCode !== summit.host && !RESIDENT_ENVOY.test(role);
            if (isAbroad && !seen.has(person.title)) {
                seen.add(person.title);
                claims.push(
                    claimOf(summit, destination, attendee, itemByTitle.get(person.title) ?? null)
                );
            }
        }
    }
    return { claims, skipped };
};

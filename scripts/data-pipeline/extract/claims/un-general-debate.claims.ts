import { type CheerioAPI, load } from "cheerio";
import type { Element } from "domhandler";

import type { CountryCode } from "@/types/geo.types";

import { cleanText, stripParenthetical } from "../../lib/text";
import {
    fetchArticleHtml,
    fetchWikidataIds,
    searchTitles,
    wikipediaUrl,
} from "../../sources/wikipedia";
import type { SkippedRow, TripClaim } from "../../types";
import type { CityLookup } from "../places.resolve";
import { countryCodeOfName } from "../places.resolve";
import { classifyTitle } from "../roles";
import { parseTripDates, type TripDates } from "../trip-dates.parse";

/**
 * The general debate of the UN General Assembly: every September each member state's leader,
 * foreign minister or envoy addresses the Assembly in New York. Wikipedia's article for each
 * session (2008 on) lists the speakers day by day, linking their articles, so each speech
 * becomes a trip to New York made by a precisely identified person. CC BY-SA.
 */

const SEARCH =
    'intitle:"General debate of the" intitle:"session of the United Nations General Assembly"';
const SEARCH_LIMIT = 100;
const SESSION_TITLE =
    /^General debate of the (.+?) session of the United Nations General Assembly$/;
/** The General Assembly's first session was in 1946, so session n meets in 1945 + n. */
const FIRST_SESSION_YEAR = 1945;
/** Held by video because of COVID-19: nobody travelled. */
const VIRTUAL_SESSIONS: ReadonlySet<number> = new Set([75]);
/** Envoys based in New York speak without travelling. */
const RESIDENT_ENVOY = /permanent representative|chargé|charge d'affaires|ambassador|observer/i;
const DAY_HEADING = /^(\d{1,2}) (September|October)\b/i;
const SCHEDULE_HEADING = /speaking schedule|list of speakers|speakers|schedule/i;
const DEBATE_RANGE = /\d{1,2}\s*[–-]\s*\d{1,2}\s+(?:September|October)\s+\d{4}/;
const SPEAKER_SEPARATOR = /\s+[–—-]\s+/;
const WIKI_LINK = "/wiki/";
const NON_ARTICLE = /^(file|image|help|wikipedia|category|template|portal|special):/i;
/** An unlinked speaker named after a common office: "President Emmanuel Macron". */
const OFFICE_AND_NAME =
    /^((?:First |Deputy |Vice[- ])?(?:President|Prime Minister|Premier|Chancellor|King|Queen|Emir|Sultan|Crown Prince|Foreign Minister|Minister for Foreign Affairs|Minister of Foreign Affairs))\s+(.+)$/;
const VENUE_CITY = "New York City";
const VENUE_COUNTRY: CountryCode = "USA";

const UNITS: Readonly<Record<string, number>> = {
    eighth: 8,
    fifth: 5,
    first: 1,
    fourth: 4,
    ninth: 9,
    second: 2,
    seventh: 7,
    sixth: 6,
    third: 3,
};
const TENS: Readonly<Record<string, number>> = {
    eighty: 80,
    fifty: 50,
    forty: 40,
    ninety: 90,
    seventy: 70,
    sixty: 60,
    thirty: 30,
    twenty: 20,
};
const ROUND_TENS: Readonly<Record<string, number>> = {
    eightieth: 80,
    fiftieth: 50,
    fortieth: 40,
    ninetieth: 90,
    seventieth: 70,
    sixtieth: 60,
    thirtieth: 30,
    twentieth: 20,
};

/**
 * Reads a session number written as an ordinal word ("sixty-third", "eightieth").
 *
 * @param word - Ordinal word.
 * @returns The number, or `null`.
 */
export const parseOrdinal = (word: string): number | null => {
    const lower = word.toLowerCase();
    if (ROUND_TENS[lower]) {
        return ROUND_TENS[lower];
    }
    const [tens, unit] = lower.split("-");
    return TENS[tens] && unit && UNITS[unit] ? TENS[tens] + UNITS[unit] : null;
};

interface Speech {
    countryName: string;
    date: TripDates;
    personName: string;
    /** The speaker's article, when linked. */
    personTitle: string | null;
    title: string;
}

const linksOf = ($: CheerioAPI, item: Element): { text: string; title: string }[] =>
    $(item)
        .find(`a[href^='${WIKI_LINK}']`)
        .toArray()
        .flatMap((anchor) => {
            const href = $(anchor).attr("href") ?? "";
            const title = decodeURIComponent(href.slice(WIKI_LINK.length).split("#")[0]).replaceAll(
                "_",
                " "
            );
            return title && !NON_ARTICLE.test(title)
                ? [{ text: cleanText($(anchor).text()), title }]
                : [];
        });

/**
 * Reads one schedule entry: "Nepal – Prime Minister Sushil Koirala". The country is linked on
 * most pages and plain text on some; the speaker's article is the last link, when linked.
 */
const readSpeech = ($: CheerioAPI, item: Element, text: string, date: TripDates): Speech | null => {
    const links = linksOf($, item);
    const [countryText = "", rawRest = ""] = text.split(SPEAKER_SEPARATOR, 2);
    const rest = cleanText(stripParenthetical(rawRest));
    const person = links.at(-1);
    const isPersonLinked = person !== undefined && rest.includes(person.text);
    const countryName =
        links.length > 1 || !isPersonLinked ? (links[0]?.title ?? countryText) : countryText;
    if (!countryName) {
        return null;
    }
    if (isPersonLinked && person) {
        return {
            countryName,
            date,
            personName: person.text,
            personTitle: person.title,
            title: cleanText(rest.replace(person.text, "")),
        };
    }
    const unlinked = rest.match(OFFICE_AND_NAME);
    return unlinked
        ? { countryName, date, personName: unlinked[2], personTitle: null, title: unlinked[1] }
        : null;
};

/**
 * Reads the speeches of one session page: the flag and country, the speaker's office and the
 * linked speaker, under the day they spoke (or the whole debate when days aren't given).
 *
 * @param html - Rendered article HTML.
 * @param year - Year the session met.
 * @returns The speeches, and list items that couldn't be read.
 */
export const parseGeneralDebate = (
    html: string,
    year: number
): { skipped: SkippedRow[]; speeches: Speech[] } => {
    const $ = load(html);
    const infobox = cleanText($("table.infobox").first().text());
    const wholeDebate = parseTripDates(infobox.match(DEBATE_RANGE)?.[0] ?? "", year);
    const speeches: Speech[] = [];
    const skipped: SkippedRow[] = [];
    let inSchedule = false;
    let day: TripDates | null = null;

    for (const element of $("h2, h3, h4, li").toArray()) {
        const text = cleanText($(element).text());
        if (element.tagName === "h2") {
            inSchedule = SCHEDULE_HEADING.test(text);
            day = null;
            continue;
        }
        if (element.tagName !== "li") {
            const match = text.match(DAY_HEADING);
            day = match ? parseTripDates(`${match[1]} ${match[2]} ${year}`, year) : day;
            continue;
        }
        if (!(inSchedule && $(element).children(".flagicon").length > 0)) {
            continue;
        }
        const date = day ?? wholeDebate;
        const speech = date ? readSpeech($, element, text, date) : null;
        if (speech) {
            speeches.push(speech);
        } else {
            skipped.push({ reason: "speaker not linked", text });
        }
    }
    return { skipped, speeches };
};

interface DebateInput {
    cities: CityLookup;
}

/**
 * Every in-person speech at the general debates Wikipedia lists, as trips to New York.
 *
 * @returns One claim per speech, and what couldn't be read.
 */
export const extractGeneralDebateClaims = async ({
    cities,
}: DebateInput): Promise<{ claims: TripClaim[]; skipped: SkippedRow[] }> => {
    const sessions = (await searchTitles(SEARCH, "en", SEARCH_LIMIT)).flatMap((title) => {
        const ordinal = title.match(SESSION_TITLE)?.[1] ?? "";
        const number = parseOrdinal(ordinal);
        return number && !VIRTUAL_SESSIONS.has(number) ? [{ number, ordinal, title }] : [];
    });
    cities.request(VENUE_COUNTRY, VENUE_CITY);
    await cities.load();
    const venue = cities.place(VENUE_COUNTRY, VENUE_CITY);
    if (!venue) {
        throw new Error("New York City could not be located");
    }

    const pages = await Promise.all(sessions.map(({ title }) => fetchArticleHtml(title)));
    const read = sessions.flatMap(({ number, ordinal, title }, index) => {
        const page = pages[index];
        return page
            ? [{ ordinal, title, ...parseGeneralDebate(page.html, FIRST_SESSION_YEAR + number) }]
            : [];
    });
    const people = await fetchWikidataIds(
        read.flatMap(({ speeches }) => speeches.flatMap((speech) => speech.personTitle ?? []))
    );

    const claims: TripClaim[] = [];
    const skipped: SkippedRow[] = [];
    for (const { ordinal, speeches, title, skipped: unread } of read) {
        skipped.push(...unread);
        for (const speech of speeches) {
            const countryCode = countryCodeOfName(speech.countryName);
            if (!countryCode) {
                skipped.push({ reason: "country not recognised", text: speech.countryName });
                continue;
            }
            if (RESIDENT_ENVOY.test(speech.title)) {
                continue;
            }
            const role = classifyTitle(speech.title);
            claims.push({
                datePrecision: "day",
                destination: venue,
                endDate: speech.date.endDate,
                engagements: [],
                eventName: "UN General Assembly general debate",
                purpose: `Addressed the general debate of the ${ordinal} session of the UN General Assembly`,
                source: "un-general-debate",
                sourceRef: { label: "Wikipedia", url: wikipediaUrl(title) },
                startDate: speech.date.startDate,
                statusHint: null,
                traveller: {
                    categories: role.categories[0] === "senior_official" ? [] : role.categories,
                    countryCode,
                    familyName: null,
                    name: speech.personName,
                    portfolio: role.portfolio,
                    title: speech.title || null,
                    wikidataId: speech.personTitle
                        ? (people.get(speech.personTitle) ?? null)
                        : null,
                },
                type: "multilateral_meeting",
            });
        }
    }
    return { claims, skipped };
};

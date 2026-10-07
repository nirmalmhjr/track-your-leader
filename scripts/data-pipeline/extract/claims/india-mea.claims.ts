import type { CountryCode } from "@/types/geo.types";
import type { Place, Portfolio, RoleCategory } from "@/types/travel.types";

import { daysInMonth, isoFromParts } from "../../lib/dates";
import { cleanText, normalizeName } from "../../lib/text";
import { fetchMeaVisits, type MeaVisit } from "../../sources/india-mea";
import type { SkippedRow, TravellerHint, TripClaim } from "../../types";
import {
    countriesInText,
    countryCodeOfName,
    countryPlace,
    type PlaceIndex,
} from "../places.resolve";
import { classifyTitle } from "../roles";
import { parseTripDates, type TripDates } from "../trip-dates.parse";
import { classifyTripType, detectEventName } from "../trip-type.classify";

/**
 * India's visit lists as trips. Each visit is one headline: "Official visit of His Majesty The
 * King of Bhutan to India (December 05-06, 2024)", "Visit of External Affairs Minister to
 * Netherlands, Denmark and Germany (May 19-24, 2025)". The headline gives the office, the
 * country and the dates; the traveller is matched later by office and date, or by name when the
 * headline gives one ("H.E. Mr. Girija Prasad Koirala, Prime Minister of Nepal").
 */

const HOME: CountryCode = "IND";
const SOURCE_LABEL = "Ministry of External Affairs, India";
const YEAR_LENGTH = 4;

type Office = Pick<TravellerHint, "categories" | "portfolio" | "title">;

/** Offices recognised in headlines, checked in order ("Vice President" before "President"). */
const OFFICES: readonly (readonly [RegExp, Office])[] = [
    [
        /\bvice[- ]president/i,
        { categories: ["deputy_leader"], portfolio: null, title: "Vice President" },
    ],
    [
        /\b(?:(?:first )?deputy prime minister|vice premier)/i,
        { categories: ["deputy_leader"], portfolio: null, title: "Deputy Prime Minister" },
    ],
    [
        /\b(?:prime minister|pm\b|premier|chancellor|taoiseach)/i,
        { categories: ["head_of_government"], portfolio: null, title: "Prime Minister" },
    ],
    [
        // "Secretary of State" alone is the US foreign minister; "for Defence" is another ministry.
        /\b(?:foreign (?:minister|secretary)|external affairs minister|eam\b|foreign affairs|secretary of state\b(?!\s+for\s+(?!foreign)))/i,
        {
            categories: ["minister"],
            portfolio: "foreign_affairs",
            title: "Minister of Foreign Affairs",
        },
    ],
    // Crown princes and governors-general aren't heads of state; "Prince" rules only in a
    // principality, so it is read from the country below.
    [/\b(?:crown prince|governor[- ]general)/i, { categories: [], portfolio: null, title: null }],
    [
        /\b(?:president|king|queen|emperor|empress|emir|amir|sultan|grand duke|grand duchess)\b/i,
        { categories: ["head_of_state"], portfolio: null, title: "Head of state" },
    ],
];
const PRINCE = /\bprince\b/i;
const PRINCIPALITIES: ReadonlySet<CountryCode> = new Set(["LIE", "MCO"]);
const MINISTER = /\bminister\b/i;
/** Deputy and junior ministers, left out: their names are rarely known elsewhere. */
const JUNIOR =
    /\b(?:deputy|vice|assistant|under)[- ](?:foreign )?(?:minister|secretary)\b|\b(?:minister of state|state minister)\b/i;
/** "French President", "German Chancellor": countries named by adjective. */
const DEMONYMS: Readonly<Record<string, CountryCode>> = {
    afghan: "AFG",
    american: "USA",
    argentine: "ARG",
    australian: "AUS",
    austrian: "AUT",
    bangladeshi: "BGD",
    belgian: "BEL",
    bhutanese: "BTN",
    brazilian: "BRA",
    british: "GBR",
    canadian: "CAN",
    chinese: "CHN",
    danish: "DNK",
    dutch: "NLD",
    egyptian: "EGY",
    emirati: "ARE",
    finnish: "FIN",
    french: "FRA",
    german: "DEU",
    greek: "GRC",
    indonesian: "IDN",
    iranian: "IRN",
    irish: "IRL",
    israeli: "ISR",
    italian: "ITA",
    japanese: "JPN",
    malaysian: "MYS",
    maldivian: "MDV",
    mexican: "MEX",
    nepalese: "NPL",
    nepali: "NPL",
    norwegian: "NOR",
    pakistani: "PAK",
    polish: "POL",
    portuguese: "PRT",
    russian: "RUS",
    saudi: "SAU",
    singaporean: "SGP",
    spanish: "ESP",
    swedish: "SWE",
    swiss: "CHE",
    thai: "THA",
    turkish: "TUR",
    vietnamese: "VNM",
};
const MAX_COUNTRY_WORDS = 3;
/** Cities of summits and UN meetings that aren't capitals; the trip is placed in the country. */
const OTHER_CITIES: Readonly<Record<string, CountryCode>> = {
    davos: "CHE",
    geneva: "CHE",
    "new york": "USA",
    "the hague": "NLD",
};

/** "State Visit of …", "Official visit of …", "Visit of a delegation led by …". */
const VISIT_OF = /\bvisits? of\s+(?:a delegation led by\s+)?/i;
/** "Prime Ministers visit to Australia" (outgoing headlines name only the office). */
const OFFICE_VISIT = /^(.+?)['’]?s? visits? to\s/i;
const TO_INDIA = /\s+to\s+(?:india|new delhi)\b.*$/i;
/** Where an outgoing visit went: after "to", up to the dates or the purpose. */
const DESTINATIONS = /\bto\s+(.+?)(?:\s*\(|,?\s+(?:for|to attend|to participate|on|from)\s|$)/i;
/** Dates at the end of a headline, taken off before reading the visitor and the places. */
const TRAILING_DATES = /(?:\(([^()]*\d[^()]*)\)?|(?:,|\bon)\s*([^,()]*\d{4}))\s*\)?\s*$/i;
const PAREN_DATES = /\(([^()]*\d[^()]*)\)?\s*$/;
const LEADING_ON = /^\s*on\s+/i;
const PRECISION_ORDER = { day: 0, month: 1, year: 2 } as const;
/** "October 31 - 03 November, 2017": a month first, then a day of another month. */
const CROSS_MONTH = /^([A-Za-z]+)\s+(\d{1,2})\s*[-–]\s*(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})$/;
const HONORIFICS =
    /\b(?:his|her|their) (?:majesty|majesties|excellency|highness|royal highness)\b|\b(?:h\.?\s?m|h\.?\s?e|h\.?\s?r\.?\s?h|mr|mrs|ms|dr|shri|smt|lyonchen|lyonpo|sheikh|the)\b\.?/gi;
const NAME = /^[A-Z][\p{L}.'’-]+(?:\s+[A-Z][\p{L}.'’-]*){1,5}$/u;
const MAX_NAME_WORDS = 6;
const WHITESPACE = /\s+/;
const PUNCTUATION = /[,.()]/g;
const TRAILING_PUNCTUATION = /[,.]+$/;
const EDGE_COMMAS = /^[\s,]+|[\s,]+$/g;
const COMMA = /,\s*/;
const TO = /\s+to\s/i;
/** "H.E. Mr. X, the Prime Minister of Y": a name, then the office. */
const COMMA_BEFORE_OFFICE = /,\s*(?=(?:the\s+)?[A-Z])/;
/** "External Affairs Minister Dr. S. Jaishankar": the office, then the name. */
const UP_TO_OFFICE = /^.*?\b(?:minister|president)\b(?: of india)?/i;

const parseDates = (text: string, listedYear: number | null): TripDates | null => {
    const cleaned = cleanText(text.replace(LEADING_ON, ""));
    const crossMonth = cleaned.match(CROSS_MONTH);
    const normalized = crossMonth
        ? `${crossMonth[2]} ${crossMonth[1]} – ${crossMonth[3]} ${crossMonth[4]} ${crossMonth[5]}`
        : cleaned;
    return normalized ? parseTripDates(normalized, listedYear) : null;
};

/**
 * The trip's dates, read from the end of the headline: in brackets, or after the last comma or
 * two ("…to India, 9-12 September, 2007"), whichever reads most precisely.
 */
const datesOf = (title: string, listedYear: number | null): TripDates | null => {
    const bracketed = title.match(PAREN_DATES)?.[1];
    if (bracketed) {
        return parseDates(bracketed, listedYear);
    }
    const segments = title.split(",");
    const candidates = [1, 2]
        .filter((count) => segments.length > count)
        .flatMap((count) => parseDates(segments.slice(-count).join(","), listedYear) ?? []);
    return (
        candidates.sort((a, b) => PRECISION_ORDER[a.precision] - PRECISION_ORDER[b.precision])[0] ??
        null
    );
};

/**
 * The country named after an "of" in a phrase ("Amir of the State of Kuwait"), and what follows
 * it ("Prime Minister of Bhutan Jigmi Y. Thinley" leaves "Jigmi Y. Thinley").
 */
const countryAfterOf = (phrase: string): { code: CountryCode; rest: string } | null => {
    const words = phrase.split(WHITESPACE);
    for (let start = 0; start < words.length; start += 1) {
        if (words[start]?.toLowerCase() !== "of") {
            continue;
        }
        for (let end = words.length; end > start + 1; end -= 1) {
            const name = words
                .slice(start + 1, end)
                .join(" ")
                .replace(TRAILING_PUNCTUATION, "");
            const code = countryCodeOfName(name);
            if (code) {
                return { code, rest: words.slice(end).join(" ") };
            }
        }
    }
    return null;
};

/**
 * A country named without "of": "United States Secretary of State", "Australian Foreign
 * Minister". The first country or adjective found, India left out.
 */
const countryInWords = (phrase: string): CountryCode | null => {
    const words = phrase.replace(PUNCTUATION, " ").split(WHITESPACE).filter(Boolean);
    for (let start = 0; start < words.length; start += 1) {
        const demonym = DEMONYMS[words[start]?.toLowerCase() ?? ""];
        if (demonym && demonym !== HOME) {
            return demonym;
        }
        for (let size = MAX_COUNTRY_WORDS; size > 0; size -= 1) {
            const code = countryCodeOfName(words.slice(start, start + size).join(" "));
            if (code && code !== HOME) {
                return code;
            }
        }
    }
    return null;
};

/** A personal name with titles taken off, or `null` when the text isn't one. */
const nameOf = (text: string): string | null => {
    const stripped = cleanText(text.replace(HONORIFICS, " ").replace(EDGE_COMMAS, ""));
    return NAME.test(stripped) && stripped.split(" ").length <= MAX_NAME_WORDS ? stripped : null;
};

/** The office a phrase names, with its portfolio for ministers. */
const officeOf = (phrase: string, code: CountryCode): Office | null => {
    if (JUNIOR.test(phrase)) {
        return null;
    }
    const known = OFFICES.find(([pattern]) => pattern.test(phrase))?.[1];
    if (known) {
        return known.categories.length > 0 ? known : null;
    }
    if (PRINCE.test(phrase) && PRINCIPALITIES.has(code)) {
        return { categories: ["head_of_state"], portfolio: null, title: "Prince" };
    }
    if (MINISTER.test(phrase)) {
        const role = classifyTitle(phrase);
        const [category] = role.categories;
        const isMinister = category === "minister" || category === "junior_minister";
        return isMinister
            ? {
                  categories: role.categories as RoleCategory[],
                  portfolio: role.portfolio as Portfolio | null,
                  title: "Minister",
              }
            : null;
    }
    return null;
};

interface Visitor {
    code: CountryCode;
    name: string | null;
    office: Office;
}

/** Who an incoming headline names: "H.E. Mr. X, Prime Minister of Nepal", "King of Bhutan". */
const incomingVisitor = (title: string): Visitor | SkippedRow => {
    const [, afterOf] = title.split(VISIT_OF);
    if (!afterOf) {
        return { reason: "not a visit", text: title };
    }
    const phrase = cleanText(afterOf.replace(TO_INDIA, "").replace(TRAILING_DATES, ""));
    const named = countryAfterOf(phrase);
    const country = named && named.code !== HOME ? named : null;
    const code = country?.code ?? countryInWords(phrase);
    if (!code) {
        return { reason: "visiting country not found", text: title };
    }
    const office = officeOf(phrase, code);
    if (!office) {
        return { reason: "office not recognised", text: title };
    }
    const [beforeComma, afterComma] = phrase.split(COMMA_BEFORE_OFFICE);
    const commaName =
        afterComma && OFFICES.some(([pattern]) => pattern.test(afterComma))
            ? nameOf(beforeComma ?? "")
            : null;
    return { code, name: commaName ?? nameOf(country?.rest ?? ""), office };
};

/** Who an outgoing headline names: India's Prime Minister, President or minister. */
const outgoingVisitor = (title: string): Visitor | SkippedRow => {
    const officeText = title.split(VISIT_OF)[1]?.split(TO)[0] ?? title.match(OFFICE_VISIT)?.[1];
    const office = officeText ? officeOf(officeText, HOME) : null;
    if (!(officeText && office)) {
        return { reason: "office not recognised", text: title };
    }
    const named = officeText.split(COMMA)[1] ?? officeText.replace(UP_TO_OFFICE, "");
    return { code: HOME, name: nameOf(named), office };
};

/**
 * Where an outgoing visit went, India left out: the countries named, or else the capitals and
 * summit cities ("to Moscow", "to New York for 73rd UNGA"), placed at that city.
 */
const destinationsOf = (title: string, places: PlaceIndex): Place[] => {
    const text = title.replace(TRAILING_DATES, "").match(DESTINATIONS)?.[1] ?? "";
    const countries = [...new Set(countriesInText(text))].filter((code) => code !== HOME);
    const named = countries.flatMap((code) => countryPlace(places, code) ?? []);
    const words = ` ${normalizeName(text)} `;
    const capitals = [...places.capitals.values()].filter(
        (capital) =>
            capital.countryCode !== HOME && words.includes(` ${normalizeName(capital.city)} `)
    );
    const cities = Object.entries(OTHER_CITIES).flatMap(([city, code]) => {
        const capital = words.includes(` ${city} `) ? countryPlace(places, code) : null;
        return capital ? [capital] : [];
    });
    // A city adds a destination only in a country not already named ("Turkey & New York").
    const elsewhere = [...capitals, ...cities].filter(
        (place, index, all) =>
            !countries.includes(place.countryCode) &&
            all.findIndex((other) => other.countryCode === place.countryCode) === index
    );
    return [...named, ...elsewhere];
};

/** A visit to several countries is dated as a whole; only the months are safe for each. */
const monthsOf = (dates: TripDates): Pick<TripClaim, "datePrecision" | "endDate" | "startDate"> => {
    const endYear = Number(dates.endDate.slice(0, YEAR_LENGTH));
    const endMonth = Number(dates.endDate.slice(5, 7));
    return {
        datePrecision: "month",
        endDate: isoFromParts(endYear, endMonth, daysInMonth(endYear, endMonth)),
        startDate: `${dates.startDate.slice(0, 7)}-01`,
    };
};

/**
 * Converts one visit.
 *
 * @param visit - Visit from MEA's lists.
 * @param places - Place index, for destinations' capitals.
 * @returns The claims (one per destination), or why the visit was skipped.
 */
export const claimsFromMeaVisit = (
    visit: MeaVisit,
    places: PlaceIndex
): TripClaim[] | SkippedRow => {
    const listedYear = Number(visit.listed.slice(-YEAR_LENGTH)) || null;
    const dates = datesOf(visit.title, listedYear);
    if (!dates) {
        return { reason: "no dates in headline", text: visit.title };
    }
    const isIncoming = visit.direction === "incoming";
    const visitor = isIncoming ? incomingVisitor(visit.title) : outgoingVisitor(visit.title);
    if ("reason" in visitor) {
        return visitor;
    }
    const destinations = isIncoming
        ? [countryPlace(places, HOME) ?? []].flat()
        : destinationsOf(visit.title, places);
    if (destinations.length === 0) {
        return { reason: "destination not found", text: visit.title };
    }
    const when =
        destinations.length > 1
            ? monthsOf(dates)
            : {
                  datePrecision: dates.precision,
                  endDate: dates.endDate,
                  startDate: dates.startDate,
              };
    return destinations.map(
        (destination): TripClaim => ({
            ...when,
            destination,
            engagements: [],
            eventName: detectEventName([], visit.title),
            purpose: null,
            source: "india-mea" as const,
            sourceRef: { label: SOURCE_LABEL, url: visit.url },
            statusHint: null,
            traveller: {
                ...visitor.office,
                countryCode: visitor.code,
                familyName: null,
                name: visitor.name,
                wikidataId: null,
            },
            type: classifyTripType(visit.title),
        })
    );
};

/**
 * Reads India's incoming and outgoing visits.
 *
 * @param places - Place index.
 * @returns Claims, and visits that could not be used.
 */
export const extractMeaClaims = async (
    places: PlaceIndex
): Promise<{ claims: TripClaim[]; skipped: SkippedRow[] }> => {
    const visits = [...(await fetchMeaVisits("incoming")), ...(await fetchMeaVisits("outgoing"))];
    const claims: TripClaim[] = [];
    const skipped: SkippedRow[] = [];
    for (const visit of visits) {
        const result = claimsFromMeaVisit(visit, places);
        if (Array.isArray(result)) {
            claims.push(...result);
        } else {
            skipped.push(result);
        }
    }
    return { claims, skipped };
};

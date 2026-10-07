import type { CountryCode } from "@/types/geo.types";
import type { Place } from "@/types/travel.types";

import { daysInMonth, isoFromParts } from "../../lib/dates";
import { cleanText, normalizeName } from "../../lib/text";
import { fetchMeaVisits, type MeaVisit } from "../../sources/india-mea";
import type { SkippedRow, TripClaim } from "../../types";
import { countriesInText, countryPlace, type PlaceIndex } from "../places.resolve";
import { parseTripDates, type TripDates } from "../trip-dates.parse";
import { classifyTripType, detectEventName } from "../trip-type.classify";
import { nameOf, officeOf, readVisitor, type Visitor } from "../visitor-titles";

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
const COMMA = /,\s*/;
const TO = /\s+to\s/i;
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

/** Who an incoming headline names: "H.E. Mr. X, Prime Minister of Nepal", "King of Bhutan". */
const incomingVisitor = (title: string): Visitor | SkippedRow => {
    const [, afterOf] = title.split(VISIT_OF);
    if (!afterOf) {
        return { reason: "not a visit", text: title };
    }
    const visitor = readVisitor(
        cleanText(afterOf.replace(TO_INDIA, "").replace(TRAILING_DATES, "")),
        HOME
    );
    return "reason" in visitor ? { reason: visitor.reason, text: title } : visitor;
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

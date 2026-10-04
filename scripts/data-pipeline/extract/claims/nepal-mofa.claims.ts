import { addDaysIso, daysInMonth, isoFromParts } from "../../lib/dates";
import { fetchMofaPressItems, type MofaPressItem } from "../../sources/nepal-mofa";
import type { SkippedRow, TravellerHint, TripClaim } from "../../types";
import { countriesInText, countryPlace, type PlaceIndex } from "../places.resolve";
import { parseTripDates } from "../trip-dates.parse";
import { classifyTripType, detectEventName } from "../trip-type.classify";

/**
 * Visits abroad announced by Nepal's foreign ministry. Headlines name the office, not the
 * person ("Visit of Hon. Minister for Foreign Affairs of Nepal to People's Republic of China"),
 * so the traveller is matched later by office and date.
 */

const HOME = "NPL";
const YEAR_LENGTH = 4;
const OUTBOUND = /\b(visit|to attend|attends?|participation|participates?)\b/i;
const INBOUND = /\bto nepal\b|\bin kathmandu\b/i;
const PRESS_PREFIX = /^press release\s*[-–:]?\s*(on (the )?)?/i;
const DAY_NUMBER = /\s*[-–]\s*day\s*(\d+)\s*$/i;
const DESTINATION = /\bto (?:pay an? (?:official |state |working )?visit to )?(.+)$/i;
const DATE_RANGE =
    /\bfrom (\d{1,2}(?:st|nd|rd|th)?(?: [A-Z][a-z]+)?) (?:to|till|until|-|–) (\d{1,2}(?:st|nd|rd|th)? [A-Z][a-z]+(?:,? \d{4})?)/;

/** Offices whose visits are recorded, checked in order (so "Vice President" beats "President"). */
const OFFICES: readonly (readonly [
    RegExp,
    Omit<TravellerHint, "countryCode" | "familyName" | "name" | "wikidataId">,
])[] = [
    [
        /\bvice[- ]president\b/i,
        { categories: ["deputy_leader"], portfolio: null, title: "Vice President of Nepal" },
    ],
    [
        /\bprime minister\b/i,
        { categories: ["head_of_government"], portfolio: null, title: "Prime Minister of Nepal" },
    ],
    [
        /\b(minister for foreign affairs|foreign minister)\b/i,
        {
            categories: ["minister"],
            portfolio: "foreign_affairs",
            title: "Minister for Foreign Affairs of Nepal",
        },
    ],
    [
        /\bpresident\b/i,
        { categories: ["head_of_state"], portfolio: null, title: "President of Nepal" },
    ],
];

/**
 * Whether a headline looks like a visit abroad by a tracked office holder.
 *
 * @param title - Press release headline.
 * @returns `true` for outbound visits.
 */
export const isOutboundVisit = (title: string): boolean =>
    OUTBOUND.test(title) &&
    !INBOUND.test(title) &&
    OFFICES.some(([pattern]) => pattern.test(title));

type DateRange = Pick<TripClaim, "datePrecision" | "endDate" | "startDate">;

const datesOf = (item: MofaPressItem, dayNumber: number | null): DateRange | null => {
    const published = item.published ? parseTripDates(item.published, null) : null;
    if (!published) {
        return null;
    }
    const year = Number(published.startDate.slice(0, YEAR_LENGTH));
    const range = item.body.match(DATE_RANGE);
    const stated = range ? parseTripDates(`${range[1]} – ${range[2]}`, year) : null;
    if (stated) {
        return {
            datePrecision: stated.precision,
            endDate: stated.endDate,
            startDate: stated.startDate,
        };
    }
    if (dayNumber !== null) {
        // "Day 2" releases come out on the second day of the visit.
        const day = published.startDate;
        return { datePrecision: "day", endDate: day, startDate: addDaysIso(day, 1 - dayNumber) };
    }
    // Announcements come out before the visit; only the month is safe to claim.
    const month = Number(published.startDate.slice(5, 7));
    return {
        datePrecision: "month",
        endDate: isoFromParts(year, month, daysInMonth(year, month)),
        startDate: isoFromParts(year, month, 1),
    };
};

/**
 * Converts one press release.
 *
 * @returns The claims, or why the release was skipped.
 */
export const claimsFromPressItem = (
    item: MofaPressItem,
    places: PlaceIndex
): TripClaim[] | SkippedRow => {
    const headline = item.title.replace(PRESS_PREFIX, "");
    const office = OFFICES.find(([pattern]) => pattern.test(headline))?.[1];
    const dayNumber = Number(headline.match(DAY_NUMBER)?.[1]) || null;
    const destinationText = headline.replace(DAY_NUMBER, "").match(DESTINATION)?.[1] ?? "";
    const countries = [...new Set(countriesInText(destinationText))].filter(
        (code) => code !== HOME
    );
    if (!office || countries.length === 0) {
        return { reason: "destination not found", text: item.title };
    }
    const dates = datesOf(item, dayNumber);
    if (!dates) {
        return { reason: "date not understood", text: item.title };
    }
    const purpose = headline.replace(DAY_NUMBER, "");
    return countries.flatMap((code) => {
        const destination = countryPlace(places, code);
        return destination
            ? [
                  {
                      ...dates,
                      destination,
                      engagements: [],
                      eventName: detectEventName([], purpose),
                      purpose,
                      source: "nepal-mofa" as const,
                      sourceRef: { label: "Ministry of Foreign Affairs of Nepal", url: item.url },
                      statusHint: null,
                      traveller: {
                          ...office,
                          countryCode: HOME,
                          familyName: null,
                          name: null,
                          wikidataId: null,
                      },
                      type: classifyTripType(purpose),
                  },
              ]
            : [];
    });
};

/**
 * Reads the ministry's press releases about visits abroad.
 *
 * @param places - Place index.
 * @returns Claims, and releases that could not be used.
 */
export const extractNepalMofaClaims = async (
    places: PlaceIndex
): Promise<{ claims: TripClaim[]; skipped: SkippedRow[] }> => {
    const items = await fetchMofaPressItems(isOutboundVisit);
    const claims: TripClaim[] = [];
    const skipped: SkippedRow[] = [];
    for (const item of items) {
        const result = claimsFromPressItem(item, places);
        if (Array.isArray(result)) {
            claims.push(...result);
        } else {
            skipped.push(result);
        }
    }
    return { claims, skipped };
};

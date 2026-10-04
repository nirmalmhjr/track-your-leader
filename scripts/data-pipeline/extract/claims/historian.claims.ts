import { cleanText } from "../../lib/text";
import {
    fetchHistorianTrips,
    type HistorianRole,
    type HistorianTrip,
    historianPageUrl,
} from "../../sources/state-historian";
import type { SkippedRow, TravellerHint, TripClaim } from "../../types";
import {
    type CityLookup,
    countryCodeOfName,
    countryPlace,
    type PlaceIndex,
} from "../places.resolve";
import { classifyTripType, detectEventName } from "../trip-type.classify";
import { shorten } from "./wikipedia.claims";

const MAX_PURPOSE_LENGTH = 140;
const HOME = "USA";

const ROLES: Readonly<Record<HistorianRole, Omit<TravellerHint, "countryCode" | "name">>> = {
    president: {
        categories: ["head_of_state", "head_of_government"],
        familyName: null,
        portfolio: null,
        title: "President of the United States",
        wikidataId: null,
    },
    secretary: {
        categories: ["minister"],
        familyName: null,
        portfolio: "foreign_affairs",
        title: "United States Secretary of State",
        wikidataId: null,
    },
};

interface HistorianContext {
    cities: CityLookup;
    places: PlaceIndex;
}

/**
 * Converts one Office of the Historian row.
 *
 * @returns The claim, or why the row was skipped.
 */
export const claimFromHistorianTrip = (
    trip: HistorianTrip,
    { cities, places }: HistorianContext
): TripClaim | SkippedRow => {
    const code = countryCodeOfName(trip.country);
    if (!code || code === HOME) {
        return { reason: "destination not found", text: `${trip.country} (${trip.locale})` };
    }
    const destination =
        (trip.locale ? cities.place(code, trip.locale) : null) ?? countryPlace(places, code);
    if (!destination) {
        return { reason: "destination not found", text: trip.country };
    }

    const remarks = cleanText(trip.remarks);
    return {
        datePrecision: "day",
        destination,
        endDate: trip.endDate,
        engagements: [],
        eventName: detectEventName([], remarks),
        purpose: remarks ? shorten(remarks, MAX_PURPOSE_LENGTH) : null,
        source: "historian",
        sourceRef: { label: "US Office of the Historian", url: historianPageUrl(trip) },
        startDate: trip.startDate,
        statusHint: null,
        traveller: { ...ROLES[trip.role], countryCode: HOME, name: trip.name || null },
        type: classifyTripType(remarks),
    };
};

/**
 * Reads every US president's and secretary of state's trip.
 *
 * @param context - Place index and city lookup.
 * @returns Claims, and rows that could not be used.
 */
export const extractHistorianClaims = async (
    context: HistorianContext
): Promise<{ claims: TripClaim[]; skipped: SkippedRow[] }> => {
    const trips = await fetchHistorianTrips();
    for (const trip of trips) {
        const code = countryCodeOfName(trip.country);
        if (code && trip.locale) {
            context.cities.request(code, trip.locale);
        }
    }
    await context.cities.load();

    const claims: TripClaim[] = [];
    const skipped: SkippedRow[] = [];
    for (const trip of trips) {
        const result = claimFromHistorianTrip(trip, context);
        if ("source" in result) {
            claims.push(result);
        } else {
            skipped.push(result);
        }
    }
    return { claims, skipped };
};

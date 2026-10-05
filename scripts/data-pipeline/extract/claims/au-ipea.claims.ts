import type { CountryCode } from "@/types/geo.types";

import { formatCiaName } from "../../lib/text";
import { fetchParliamentarianTrips, IPEA_URL } from "../../sources/au-ipea";
import type { SkippedRow, TripClaim } from "../../types";
import type { CityLookup, PlaceIndex } from "../places.resolve";
import { parseTripDates } from "../trip-dates.parse";
import { classifyTripType } from "../trip-type.classify";
import { placesOf, requestPlaces } from "./free-text-places";
import { shorten } from "./wikipedia.claims";

/**
 * Australian parliamentarians' international travel: one claim per country of each trip.
 * Ministers' government travel is paid by their departments and isn't in these files.
 */

const HOME: CountryCode = "AUS";
const MAX_PURPOSE_LENGTH = 140;
/** "Official Travel - Singapore and Japan" says nothing beyond the destinations. */
const GENERIC_REASON = /^official travel\b/i;

interface IpeaInput {
    cities: CityLookup;
    places: PlaceIndex;
}

/**
 * Every international trip in the expenses files.
 *
 * @returns One claim per country of each trip, and trips that couldn't be read.
 */
export const extractIpeaClaims = async ({
    cities,
    places,
}: IpeaInput): Promise<{ claims: TripClaim[]; skipped: SkippedRow[] }> => {
    const trips = await fetchParliamentarianTrips();
    for (const trip of trips) {
        requestPlaces(trip.toLocation, HOME, cities);
    }
    await cities.load();

    const claims: TripClaim[] = [];
    const skipped: SkippedRow[] = [];
    for (const trip of trips) {
        const dates = parseTripDates(`${trip.startDate} – ${trip.endDate}`, null);
        const destinations = placesOf(trip.toLocation, HOME, { cities, places });
        if (!dates || destinations.length === 0) {
            skipped.push({
                reason: dates ? "destination not found" : "date not understood",
                text: `${trip.surname}: ${trip.toLocation} ${trip.startDate}`,
            });
            continue;
        }
        const name = `${trip.firstName} ${formatCiaName(trip.surname)}`.trim();
        const reason = GENERIC_REASON.test(trip.reason) ? null : trip.reason || null;
        for (const destination of destinations) {
            claims.push({
                datePrecision: "day",
                destination,
                endDate: dates.endDate,
                engagements: [],
                eventName: null,
                purpose: reason ? shorten(reason, MAX_PURPOSE_LENGTH) : null,
                source: "au-ipea",
                sourceRef: { label: "Independent Parliamentary Expenses Authority", url: IPEA_URL },
                startDate: dates.startDate,
                statusHint: null,
                traveller: {
                    categories: ["legislator"],
                    countryCode: HOME,
                    familyName: formatCiaName(trip.surname),
                    name,
                    portfolio: null,
                    title: trip.fullNameWithTitle.startsWith("Senator")
                        ? "Senator"
                        : "Member of Parliament",
                    wikidataId: null,
                },
                type: classifyTripType(trip.reason, null),
            });
        }
    }
    return { claims, skipped };
};

import type { CountryCode } from "@/types/geo.types";

import { fetchMemberVisits, UK_REGISTER_URL } from "../../sources/uk-parliament";
import type { SkippedRow, TripClaim } from "../../types";
import type { CityLookup, PlaceIndex } from "../places.resolve";
import { parseTripDates } from "../trip-dates.parse";
import { classifyTripType } from "../trip-type.classify";
import { placesOf, requestPlaces } from "./free-text-places";
import { shorten } from "./wikipedia.claims";

/**
 * MPs' registered visits outside the UK: one claim per country visited, made by the named MP.
 * Ministers travelling on government business appear in the GOV.UK data instead; these are the
 * visits others paid for (governments, charities, all-party groups).
 */

const HOME: CountryCode = "GBR";
const MAX_PURPOSE_LENGTH = 140;

interface ParliamentInput {
    cities: CityLookup;
    places: PlaceIndex;
}

/**
 * Every registered visit of a sitting MP.
 *
 * @returns One claim per country of each visit, and visits that couldn't be read.
 */
export const extractUkParliamentClaims = async ({
    cities,
    places,
}: ParliamentInput): Promise<{ claims: TripClaim[]; skipped: SkippedRow[] }> => {
    const visits = await fetchMemberVisits();
    const textOf = (city: string | null, country: string): string =>
        city ? `${city}, ${country}` : country;
    for (const visit of visits) {
        for (const { city, country } of visit.destinations) {
            requestPlaces(textOf(city, country), HOME, cities);
        }
    }
    await cities.load();

    const claims: TripClaim[] = [];
    const skipped: SkippedRow[] = [];
    for (const visit of visits) {
        const dates =
            visit.startDate && visit.endDate
                ? parseTripDates(`${visit.startDate} – ${visit.endDate}`, null)
                : null;
        if (!dates) {
            skipped.push({
                reason: "date not understood",
                text: `${visit.member} ${visit.startDate}`,
            });
            continue;
        }
        const destinations = visit.destinations.flatMap(({ city, country }) =>
            placesOf(textOf(city, country), HOME, { cities, places })
        );
        if (destinations.length === 0) {
            skipped.push({
                reason: "destination not found",
                text: visit.destinations.map((entry) => entry.country).join(", "),
            });
            continue;
        }
        for (const destination of destinations) {
            claims.push({
                datePrecision: "day",
                destination,
                endDate: dates.endDate,
                engagements: [],
                eventName: null,
                purpose: visit.purpose ? shorten(visit.purpose, MAX_PURPOSE_LENGTH) : null,
                source: "uk-parliament",
                sourceRef: { label: "UK Parliament register of interests", url: UK_REGISTER_URL },
                startDate: dates.startDate,
                statusHint: null,
                traveller: {
                    categories: ["legislator"],
                    countryCode: HOME,
                    familyName: null,
                    name: visit.member,
                    portfolio: null,
                    title: visit.memberFrom
                        ? `Member of Parliament for ${visit.memberFrom}`
                        : "Member of Parliament",
                    wikidataId: null,
                },
                type: classifyTripType(visit.purpose ?? "", null),
            });
        }
    }
    return { claims, skipped };
};

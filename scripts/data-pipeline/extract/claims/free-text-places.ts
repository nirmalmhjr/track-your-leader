import type { Place } from "@/features/travel-explorer/types/travel.types";
import type { CountryCode } from "@/types/geo.types";

import {
    type CityLookup,
    countriesInText,
    countryCodeOfName,
    countryPlace,
    type PlaceIndex,
} from "../places.resolve";

/**
 * Destinations written as free text ("Baku, Azerbaijan", "Paris and Brussels, France"). Every
 * country named becomes a destination; a city is only claimed when exactly one foreign country
 * is named, so a city is never attached to the wrong country.
 */

const PART_SEPARATOR = /[,;/&()]| and /;
const DIGIT = /\d/;
/** Parts that are regions or qualifiers, not cities ("D.C.", "USA", "via"). */
const NOT_A_CITY = /^(d\.?c\.?|via|various|tbc|n\/a|city|province|state|region)$/i;

interface FreeTextContext {
    cities: CityLookup;
    places: PlaceIndex;
}

const foreignCountries = (text: string, home: CountryCode): CountryCode[] =>
    [...new Set(countriesInText(text))].filter((code) => code !== home);

/**
 * The likeliest city in a destination text: its first part that isn't a country.
 *
 * @param text - Destination text.
 * @returns The city name, or `null`.
 */
export const cityCandidateOf = (text: string): string | null =>
    text
        .split(PART_SEPARATOR)
        .map((part) => part.trim())
        .find(
            (part) =>
                part.length > 1 &&
                !DIGIT.test(part) &&
                !NOT_A_CITY.test(part) &&
                countryCodeOfName(part) === null
        ) ?? null;

/**
 * Queues the city in a destination text for lookup (call before `CityLookup.load`).
 *
 * @param text - Destination text.
 * @param home - Traveller's country, which is never a destination.
 * @param cities - City lookup.
 */
export const requestPlaces = (text: string, home: CountryCode, cities: CityLookup): void => {
    const countries = foreignCountries(text, home);
    const city = cityCandidateOf(text);
    if (countries.length === 1 && city) {
        cities.request(countries[0], city);
    }
};

/**
 * Destinations named in a text, one per foreign country.
 *
 * @param text - Destination text.
 * @param home - Traveller's country, which is never a destination.
 * @param context - City lookup (already loaded) and place index.
 * @returns The places; empty when no foreign country is named.
 */
export const placesOf = (
    text: string,
    home: CountryCode,
    { cities, places }: FreeTextContext
): Place[] => {
    const countries = foreignCountries(text, home);
    const city = countries.length === 1 ? cityCandidateOf(text) : null;
    return countries.flatMap((code) => {
        const place = (city ? cities.place(code, city) : null) ?? countryPlace(places, code);
        return place ? [place] : [];
    });
};

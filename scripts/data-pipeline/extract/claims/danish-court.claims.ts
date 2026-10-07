import type { CountryCode } from "@/types/geo.types";
import type { IsoDate } from "@/types/travel.types";

import { DANISH_COURT_URL, type DanishVisit, fetchDanishVisits } from "../../sources/danish-court";
import type { SkippedRow, TravellerHint, TripClaim } from "../../types";
import { countryPlace, loadCountryNames, type PlaceIndex } from "../places.resolve";
import { parseTripDates } from "../trip-dates.parse";

/**
 * The Danish Royal House's visits as trips. State visits abroad are the monarch's: Margrethe II
 * until 14 January 2024, Frederik X since. Official visits name who went; only the monarchs'
 * count (Margrethe II, and Frederik X, also before his accession), not consorts or other royals.
 * State visits to Denmark are trips of each visiting head of state.
 */

const HOME: CountryCode = "DNK";
const SOURCE_LABEL = "Danish Royal House";
const MARGRETHE = "Q102139";
const FREDERIK = "Q1004037";
const ACCESSION: IsoDate = "2024-01-14";
/** Danish names Wikidata's labels lack. */
const HISTORICAL_NAMES: Readonly<Record<string, CountryCode>> = {
    "abu dhabi": "ARE",
    england: "GBR",
    "forbundsrepublikken tyskland": "DEU",
    jugoslavien: "SRB",
    korea: "KOR",
    nederlandene: "NLD",
    "new york": "USA",
    "slesvig holsten": "DEU",
    sovjetunionen: "RUS",
    sydslesvig: "DEU",
    tjekkoslovakiet: "CZE",
    "u s a": "USA",
    "washington dc": "USA",
};
/** "Den Socialistiske Republik Vietnam", "Den Arabiske Republik Egypten": the formal part. */
const DANISH_FORMAL = /^den\s+(?:\S+\s+)*?republik\s+/i;
/** What follows a place: "i anledning af …" (on the occasion of), "med …" (with). */
const PLACE_SUFFIX = /\s+(?:i anledning af|med|til|for)\s.*$/i;
/** Visits that didn't happen in person: postponed, cancelled, held online. */
const NOT_HELD = /\b(?:udskudt|aflyst|digital|virtuel)/i;
/** "Tanzania og Mexico", "Estland, Letland, Litauen og Norge". */
const LIST_SEPARATOR = /,\s*|\s+og\s+/;
const KING = /^H\.M\. Kongen\b/;
const QUEEN = /^H\.M\. Dronningen\b/;
const MARGRETHE_NAMED = /^H\.M\. Dronning Margrethe\b/;
const AS_CONSORT = /daværende kronprinsesse/i;

/** Who made an official visit, by Wikidata id: only the monarchs, past and present. */
const monarchOf = (person: string | null, year: number): string | null => {
    if (!person) {
        return null;
    }
    if (KING.test(person)) {
        return FREDERIK;
    }
    if (MARGRETHE_NAMED.test(person)) {
        return MARGRETHE;
    }
    // "H.M. Dronningen" was Margrethe until her abdication; since, it is Queen Mary.
    return QUEEN.test(person) && !AS_CONSORT.test(person) && year < Number(ACCESSION.slice(0, 4))
        ? MARGRETHE
        : null;
};

/** The monarch on a state visit abroad. A visit known only by its year: Margrethe II made none in 2024. */
const regentOn = (startDate: IsoDate, year: number): string =>
    startDate >= ACCESSION || year >= Number(ACCESSION.slice(0, 4)) ? FREDERIK : MARGRETHE;

/** Who travelled abroad, by Wikidata id: the regent on state visits, the named monarch otherwise. */
const travellingMonarch = (visit: DanishVisit, startDate: IsoDate): string | null =>
    visit.kind === "outgoing"
        ? regentOn(startDate, visit.year)
        : monarchOf(visit.person, visit.year);

const datesOf = (
    visit: DanishVisit
): Pick<TripClaim, "datePrecision" | "endDate" | "startDate"> => {
    const exact = visit.dates ? parseTripDates(visit.dates, visit.year) : null;
    return exact
        ? { datePrecision: exact.precision, endDate: exact.endDate, startDate: exact.startDate }
        : {
              datePrecision: "year",
              endDate: `${visit.year}-12-31`,
              startDate: `${visit.year}-01-01`,
          };
};

const travellerOf = (wikidataId: string): TravellerHint => ({
    categories: [],
    countryCode: HOME,
    familyName: null,
    name: wikidataId === FREDERIK ? "Frederik X" : "Margrethe II",
    portfolio: null,
    title: null,
    wikidataId,
});

interface Context {
    countryOf: (name: string) => CountryCode | null;
    places: PlaceIndex;
}

/**
 * Converts one listed visit.
 *
 * @returns One claim per country, `null` for visits by other royals, or why it was skipped.
 */
export const claimsFromDanishVisit = (
    visit: DanishVisit,
    { countryOf, places }: Context
): TripClaim[] | SkippedRow | null => {
    if (NOT_HELD.test(`${visit.places} ${visit.dates ?? ""}`)) {
        return null;
    }
    const dates = datesOf(visit);
    // Trips abroad count only for the monarchs; consorts' and other royals' are left out.
    const monarch = visit.kind === "incoming" ? null : travellingMonarch(visit, dates.startDate);
    if (visit.kind !== "incoming" && !monarch) {
        return null;
    }
    // "Rom, Italien" and "Saudi-Arabien og Qatar" alike: every part that names a country.
    const known = [
        ...new Set(
            visit.places
                .replace(PLACE_SUFFIX, "")
                .split(LIST_SEPARATOR)
                .map((name) => countryOf(name) ?? countryOf(name.replace(DANISH_FORMAL, "")))
                .filter((code): code is CountryCode => code !== null && code !== HOME)
        ),
    ];
    if (known.length === 0) {
        return { reason: "country not found", text: `${visit.year} ${visit.places}` };
    }
    const base = {
        ...dates,
        engagements: [],
        eventName: null,
        purpose: null,
        source: "danish-court" as const,
        sourceRef: { label: SOURCE_LABEL, url: DANISH_COURT_URL },
        statusHint: null,
    };
    if (visit.kind === "incoming") {
        const destination = countryPlace(places, HOME);
        return destination
            ? known.map((code) => ({
                  ...base,
                  destination,
                  traveller: {
                      categories: ["head_of_state"],
                      countryCode: code,
                      familyName: null,
                      name: null,
                      portfolio: null,
                      title: "Head of state",
                      wikidataId: null,
                  },
                  type: "state_visit",
              }))
            : [];
    }
    if (!monarch) {
        return null;
    }
    return known.flatMap((code) => {
        const destination = countryPlace(places, code);
        return destination
            ? [
                  {
                      ...base,
                      destination,
                      traveller: travellerOf(monarch),
                      type:
                          visit.kind === "outgoing"
                              ? ("state_visit" as const)
                              : ("official_visit" as const),
                  },
              ]
            : [];
    });
};

/**
 * Reads the Danish Royal House's visits.
 *
 * @param places - Place index.
 * @returns Claims, and visits that could not be used.
 */
export const extractDanishCourtClaims = async (
    places: PlaceIndex
): Promise<{ claims: TripClaim[]; skipped: SkippedRow[] }> => {
    const countryOf = await loadCountryNames("da", HISTORICAL_NAMES);
    const claims: TripClaim[] = [];
    const skipped: SkippedRow[] = [];
    for (const visit of await fetchDanishVisits()) {
        // Margrethe II reigned from 1972; earlier entries are another monarch's.
        if (visit.year < 1972) {
            continue;
        }
        const result = claimsFromDanishVisit(visit, { countryOf, places });
        if (Array.isArray(result)) {
            claims.push(...result);
        } else if (result) {
            skipped.push(result);
        }
    }
    return { claims, skipped };
};

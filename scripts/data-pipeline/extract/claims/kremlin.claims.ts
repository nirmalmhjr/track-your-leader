import type { CountryCode } from "@/types/geo.types";
import type { Place } from "@/types/travel.types";

import { normalizeName } from "../../lib/text";
import { fetchKremlinEvents, type KremlinEvent } from "../../sources/kremlin";
import type { SkippedRow, TripClaim } from "../../types";
import { countryCodeOfName, countryPlace, type PlaceIndex } from "../places.resolve";
import { classifyTripType, detectEventName } from "../trip-type.classify";
import { readVisitor } from "../visitor-titles";

/**
 * The Kremlin's meetings with foreign leaders as those leaders' trips: where the meeting took
 * place is where the visitor was that day. "Meeting with President of Egypt Abdel Fattah
 * el-Sisi", Sochi: el-Sisi in Russia. Phone calls and video calls have no place, and a meeting in
 * the visitor's own country is the Russian President's trip, not theirs.
 */

const HOST: CountryCode = "RUS";
const SOURCE_LABEL = "Kremlin (CC BY 4.0)";
/**
 * In-person meetings: "Meeting with …", "Talks with …", "Conversation with …", and the older
 * sentences "President Vladimir Putin met with …", "Dmitry Medvedev held talks with …".
 */
const MEETING =
    /^(?:(?:(?:working |informal |brief )?meeting|(?:russian[–-]\S+ )?talks|conversation)|(?:acting )?(?:president (?:and prime minister )?)?(?:vladimir putin|dmitry medvedev|putin|medvedev) (?:met|held (?:a )?(?:working )?(?:meeting|talks)|had a (?:working )?meeting)(?: at the kremlin)?) with\s+(.+?)\.?$/i;
const REMOTE = /\b(?:telephone|phone|video ?(?:link|conference)|videoconference)\b/i;
/** Places in Russia as the Kremlin writes them. */
const RUSSIAN_PLACE =
    /\b(?:kremlin|moscow|sochi|st\.? petersburg|saint petersburg|novo-ogaryovo|kazan|vladivostok|valdai|kaliningrad|yekaterinburg|nizhny novgorod|novosibirsk|ufa|sevastopol|yalta|crimea|volgograd|astrakhan|krasnoyarsk|bocharov ruchei|konstantinovsky|strelna|zavidovo|russky island|tver|tula|pskov|smolensk|ulyanovsk|chelyabinsk|orenburg|samara|kursk|belgorod|grozny|makhachkala|derbent|murmansk|arkhangelsk|khabarovsk|blagoveshchensk|yakutsk|irkutsk|omsk|tomsk|perm|cheboksary|saransk|saratov|voronezh|rostov|krasnodar|novorossiysk|veliky novgorod|kostroma|yaroslavl|ryazan|kaluga|bryansk|lipetsk|valaam|krasnaya polyana|region|territory)\b/i;
/** Summit cities abroad that aren't capitals. */
const OTHER_CITIES: Readonly<Record<string, CountryCode>> = {
    aktau: "KAZ",
    almaty: "KAZ",
    bethlehem: "PSE",
    "da nang": "VNM",
    danang: "VNM",
    davos: "CHE",
    geneva: "CHE",
    hamburg: "DEU",
    hangzhou: "CHN",
    harbin: "CHN",
    istanbul: "TUR",
    johannesburg: "ZAF",
    mogilev: "BLR",
    nagato: "JPN",
    "new york": "USA",
    "nur sultan": "KAZ",
    osaka: "JPN",
    qingdao: "CHN",
    samarkand: "UZB",
    shanghai: "CHN",
    "the hague": "NLD",
    tianjin: "CHN",
    xiamen: "CHN",
    zagulba: "AZE",
};

/**
 * Where a meeting took place: a Russian venue, a foreign capital, or a known summit city.
 *
 * @param place - The Kremlin's place ("Sochi", "New Delhi").
 * @param places - Place index, for capitals.
 * @returns The place, or `null` when it can't be located.
 */
export const meetingPlace = (place: string, places: PlaceIndex): Place | null => {
    if (RUSSIAN_PLACE.test(place)) {
        return countryPlace(places, HOST);
    }
    const key = normalizeName(place.split(",")[0] ?? place);
    const capital = [...places.capitals.values()].find(
        (candidate) => normalizeName(candidate.city) === key
    );
    if (capital) {
        return capital;
    }
    const lastPart = place.split(",").at(-1) ?? place;
    const code = OTHER_CITIES[key] ?? countryCodeOfName(lastPart);
    return code ? countryPlace(places, code) : null;
};

/**
 * Converts one Kremlin event.
 *
 * @param event - Event from the list.
 * @param places - Place index.
 * @returns The visitor's trip, `null` for events that aren't meetings, or why it was skipped.
 */
export const claimFromKremlinEvent = (
    event: KremlinEvent,
    places: PlaceIndex
): TripClaim | SkippedRow | null => {
    const phrase = event.title.match(MEETING)?.[1];
    if (!phrase || REMOTE.test(event.title) || !event.place) {
        return null;
    }
    const visitor = readVisitor(phrase, HOST);
    if ("reason" in visitor) {
        // Mostly Russian officials and groups ("Meeting with Government members").
        return null;
    }
    const destination = meetingPlace(event.place, places);
    if (!destination) {
        return { reason: "place not located", text: `${event.place}: ${event.title}` };
    }
    if (destination.countryCode === visitor.code) {
        return null;
    }
    return {
        datePrecision: "day",
        destination,
        endDate: event.date,
        engagements: [],
        eventName: detectEventName([], event.title),
        purpose: event.title,
        source: "kremlin",
        sourceRef: { label: SOURCE_LABEL, url: event.url },
        startDate: event.date,
        statusHint: null,
        traveller: {
            ...visitor.office,
            countryCode: visitor.code,
            familyName: null,
            name: visitor.name,
            wikidataId: null,
        },
        type: classifyTripType(event.title),
    };
};

/**
 * Reads the Kremlin's meetings with foreign leaders.
 *
 * @param places - Place index.
 * @returns Claims, and meetings whose place couldn't be located.
 */
export const extractKremlinClaims = async (
    places: PlaceIndex
): Promise<{ claims: TripClaim[]; skipped: SkippedRow[] }> => {
    const claims: TripClaim[] = [];
    const skipped: SkippedRow[] = [];
    for (const event of await fetchKremlinEvents()) {
        const result = claimFromKremlinEvent(event, places);
        if (result && "reason" in result) {
            skipped.push(result);
        } else if (result) {
            claims.push(result);
        }
    }
    return { claims, skipped };
};

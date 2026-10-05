import assert from "node:assert/strict";
import { test } from "node:test";

import {
    buildCountryDirectory,
    buildCountryList,
    buildOverview,
    countTripsByYear,
    groupRecordsByOfficial,
    parseCountryParam,
    rankDestinations,
} from "@/features/leaders/utils/leaders.utils";
import type { TravelBase } from "@/features/travel-explorer/data/travel-index";
import type {
    Official,
    Place,
    Position,
    TrackedCountry,
    TravelRecord,
    TravelStatus,
} from "@/types/travel.types";

const place = (countryCode: string, city: string): Place => ({
    city,
    coordinates: [0, 0],
    countryCode,
    region: "Asia",
});

const country = (code: string): TrackedCountry => ({
    capital: place(code, `${code} capital`),
    code,
    governmentSystem: null,
    name: code,
});

const position = (overrides: Partial<Position> & Pick<Position, "title">): Position => ({
    categories: ["minister"],
    endDate: null,
    id: overrides.title,
    ministry: null,
    portfolio: null,
    startDate: null,
    ...overrides,
});

const official = (id: string, countryCode: string, positions: Position[]): Official => ({
    countryCode,
    fullName: id,
    id,
    party: null,
    photoUrl: null,
    positions,
    sources: [],
    summary: "",
    wikidataId: null,
});

const trip = (
    officialId: string,
    countryCode: string,
    destination: string,
    startDate: string,
    status: TravelStatus = "completed"
): TravelRecord => ({
    datePrecision: "day",
    destination: place(destination, `${destination} city`),
    endDate: startDate,
    engagements: [],
    eventName: null,
    id: `${officialId}-${startDate}-${destination}`,
    officialId,
    origin: place(countryCode, `${countryCode} capital`),
    originCountryCode: countryCode,
    positionTitle: "",
    purpose: "",
    sources: [],
    startDate,
    status,
    type: "official_visit",
});

const president = official("president", "NPL", [
    position({ categories: ["head_of_state"], title: "President" }),
]);
const minister = official("minister", "NPL", [position({ title: "Foreign Minister" })]);
const formerPm = official("former-pm", "NPL", [
    position({
        categories: ["head_of_government"],
        endDate: "2020-01-01",
        startDate: "2018-01-01",
        title: "Prime Minister",
    }),
]);
const japanPm = official("japan-pm", "JPN", [
    position({ categories: ["head_of_government"], title: "Prime Minister" }),
]);

const nepalTrips = [
    trip("minister", "NPL", "IND", "2026-09-01"),
    trip("minister", "NPL", "CHN", "2026-06-01"),
    trip("minister", "NPL", "IND", "2026-03-01"),
    trip("president", "NPL", "IND", "2026-08-01", "cancelled"),
    trip("former-pm", "NPL", "USA", "2019-05-01"),
];
const japanTrips = [trip("japan-pm", "JPN", "USA", "2026-07-01")];

const base: TravelBase = {
    countries: [country("NPL"), country("JPN")],
    officials: [minister, formerPm, president, japanPm],
    recordsByOrigin: new Map([
        ["NPL", nepalTrips],
        ["JPN", japanTrips],
    ]),
    updatedOn: "2026-10-01",
};
const recordsByOfficial = groupRecordsByOfficial(base);

test("parseCountryParam accepts three-letter codes in any case", () => {
    assert.equal(parseCountryParam("npl"), "NPL");
    assert.equal(parseCountryParam("NPL"), "NPL");
    assert.equal(parseCountryParam("nepal"), null);
    assert.equal(parseCountryParam("n1l"), null);
});

test("buildCountryList counts officials, those in office and non-cancelled trips", () => {
    assert.deepEqual(buildCountryList(base), [
        { code: "NPL", inOfficeCount: 2, officialCount: 3, tripCount: 4 },
        { code: "JPN", inOfficeCount: 1, officialCount: 1, tripCount: 1 },
    ]);
});

test("buildCountryDirectory lists leaders in office by seniority with their travel", () => {
    const directory = buildCountryDirectory(base, "NPL", recordsByOfficial);
    assert.ok(directory);
    assert.deepEqual(
        directory.inOffice.map((entry) => entry.official.id),
        ["president", "minister"]
    );
    assert.equal(directory.inOffice[1].summary.tripCount, 3);
    assert.equal(directory.inOffice[0].summary.tripCount, 0);
    assert.deepEqual(directory.tenure, { current: 2, former: 1 });
    assert.equal(directory.officials.length, 3);
    assert.equal(directory.tripCount, 4);
});

test("buildCountryDirectory returns null for untracked countries", () => {
    assert.equal(buildCountryDirectory(base, "FRA", recordsByOfficial), null);
});

test("buildOverview ranks leaders in office by completed trips in the past year", () => {
    const overview = buildOverview(base, recordsByOfficial, "2026-10-05");
    assert.deepEqual(
        overview.topTravellers.map((entry) => [entry.official.id, entry.recentTripCount]),
        [
            ["minister", 3],
            ["japan-pm", 1],
        ]
    );
    assert.equal(overview.countryCount, 2);
    assert.equal(overview.officialCount, 4);
    assert.equal(overview.tripCount, 5);
});

test("countTripsByYear fills years without travel and skips cancelled trips", () => {
    const records = [
        trip("a", "NPL", "IND", "2023-02-01"),
        trip("a", "NPL", "IND", "2025-02-01"),
        trip("a", "NPL", "IND", "2025-06-01"),
        trip("a", "NPL", "IND", "2026-01-01", "cancelled"),
    ];
    assert.deepEqual(countTripsByYear(records), [
        { count: 1, year: "2023" },
        { count: 0, year: "2024" },
        { count: 2, year: "2025" },
    ]);
    assert.deepEqual(countTripsByYear([]), []);
});

test("rankDestinations orders countries by trips and respects the limit", () => {
    assert.deepEqual(rankDestinations(nepalTrips, 2), [
        { count: 2, countryCode: "IND" },
        { count: 1, countryCode: "CHN" },
    ]);
});

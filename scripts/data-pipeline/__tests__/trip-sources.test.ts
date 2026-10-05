import assert from "node:assert/strict";
import { test } from "node:test";

import type { Place } from "@/types/travel.types";

import { isMinisterTitle, normalizeCanadianName } from "../extract/claims/canada.claims";
import { claimFromColtRow, excelSerialToIso } from "../extract/claims/colt.claims";
import { cityCandidateOf, placesOf } from "../extract/claims/free-text-places";
import { claimFromHistorianTrip } from "../extract/claims/historian.claims";
import { claimsFromPressItem, isOutboundVisit } from "../extract/claims/nepal-mofa.claims";
import { parseMinisterCell, parseUkDate } from "../extract/claims/uk.claims";
import { type CityLookup, countryCodeOfName, type PlaceIndex } from "../extract/places.resolve";
import type { ColtRow } from "../sources/colt";

const capital = (countryCode: string, city: string): Place => ({
    city,
    coordinates: [0, 0],
    countryCode,
    region: "Asia",
});

const places: PlaceIndex = {
    capitals: new Map([
        ["AZE", capital("AZE", "Baku")],
        ["CHN", capital("CHN", "Beijing")],
        ["JPN", capital("JPN", "Tokyo")],
        ["KOR", capital("KOR", "Seoul")],
        ["QAT", capital("QAT", "Doha")],
        ["USA", capital("USA", "Washington, D.C.")],
        ["VNM", capital("VNM", "Hanoi")],
    ]),
    codeByItem: new Map(),
    itemByCode: new Map(),
};

const cities = (known: Record<string, Place> = {}): CityLookup => ({
    load: async () => undefined,
    place: (code, name) => known[`${code}:${name}`] ?? null,
    request: () => undefined,
    save: async () => undefined,
});

const coltRow = (overrides: Partial<ColtRow>): ColtRow => ({
    attendedEvent: "No",
    city: "",
    endDate: "43597",
    eventName: "",
    exiled: "0",
    familyName: "Oli",
    fullName: "K.P. Sharma Oli",
    hostName: "",
    leaderCountry: "NPL",
    metHost: "No",
    ministerialEventName: "",
    publicAddress: "No",
    role: "G",
    signedAgreement: "No",
    startDate: "43594",
    title: "Prime Minister",
    tripId: "3153-NPL-VNM-43594",
    visitedCountry: "VNM",
    year: "2019",
    ...overrides,
});

test("historical and alternative country names resolve to ISO codes", () => {
    assert.equal(countryCodeOfName("Soviet Union"), "RUS");
    assert.equal(countryCodeOfName("the People’s Republic of China"), "CHN");
    assert.equal(countryCodeOfName("Burma"), "MMR");
    assert.equal(countryCodeOfName("Atlantis"), null);
});

test("COLT rows become country-precision claims with roles and engagements", () => {
    assert.equal(excelSerialToIso("43594"), "2019-05-09");
    assert.equal(excelSerialToIso(""), null);

    const claim = claimFromColtRow(
        coltRow({ hostName: "President Nguyen Phu Trong", metHost: "Yes" }),
        { cities: cities(), places }
    );
    assert.ok("source" in claim);
    assert.equal(claim.startDate, "2019-05-09");
    assert.equal(claim.endDate, "2019-05-12");
    assert.equal(claim.destination.precision, "country");
    assert.deepEqual(claim.traveller.categories, ["head_of_government"]);
    assert.equal(claim.traveller.familyName, "Oli");
    assert.deepEqual(claim.engagements, ["Met President Nguyen Phu Trong"]);
    assert.equal(claim.type, "official_visit");

    const summit = claimFromColtRow(
        coltRow({
            attendedEvent: "Yes",
            eventName: "United Nations (UN) General Assembly;Summit of the Future",
            visitedCountry: "USA",
        }),
        { cities: cities(), places }
    );
    assert.ok("source" in summit);
    assert.equal(summit.eventName, "United Nations (UN) General Assembly");
    assert.equal(summit.type, "summit");
});

test("COLT rows about organisations, exiles or untracked heads of state are skipped", () => {
    const context = { cities: cities(), places };
    assert.ok(!("source" in claimFromColtRow(coltRow({ role: "I" }), context)));
    assert.ok(!("source" in claimFromColtRow(coltRow({ exiled: "1" }), context)));
    // Australia's head of state is the British monarch, tracked under the UK.
    assert.ok(
        !("source" in claimFromColtRow(coltRow({ leaderCountry: "AUS", role: "S" }), context))
    );
});

test("Office of the Historian rows keep the city when it can be located", () => {
    const tokyo = { ...capital("JPN", "Tokyo") };
    const claim = claimFromHistorianTrip(
        {
            country: "Japan",
            endDate: "2021-03-17",
            locale: "Tokyo",
            name: "Antony John Blinken",
            remarks: "Attended the U.S.-Japan Security Consultative Committee meeting.",
            role: "secretary",
            startDate: "2021-03-15",
            who: "blinken-antony-j",
        },
        { cities: cities({ "JPN:Tokyo": tokyo }), places }
    );
    assert.ok("source" in claim);
    assert.equal(claim.destination.precision, undefined);
    assert.equal(claim.traveller.portfolio, "foreign_affairs");
    assert.equal(
        claim.sourceRef.url,
        "https://history.state.gov/departmenthistory/travels/secretary/blinken-antony-j"
    );
});

test("UK minister cells separate the office from the name and honorifics", () => {
    assert.deepEqual(
        parseMinisterCell(
            "Secretary of State for Business, Innovation & Skills and President of the Board of Trade, Rt Hon Vincent Cable MP"
        ),
        {
            name: "Vincent Cable",
            title: "Secretary of State for Business, Innovation & Skills and President of the Board of Trade",
        }
    );
    assert.deepEqual(parseMinisterCell("Ed Miliband"), { name: "Ed Miliband", title: null });
    assert.deepEqual(parseMinisterCell("Minister of State for the Armed Forces - Mark Lancaster"), {
        name: "Mark Lancaster",
        title: "Minister of State for the Armed Forces",
    });
    assert.deepEqual(
        parseMinisterCell(
            "Parliamentary Under Secretary of State (Minister for Employment Relations, Consumer and Postal Affairs), Edward Davey"
        ),
        {
            name: "Edward Davey",
            title: "Parliamentary Under Secretary of State (Minister for Employment Relations, Consumer and Postal Affairs)",
        }
    );
    assert.equal(parseMinisterCell("EARL HOWE").name, "Earl Howe");
    assert.deepEqual(parseMinisterCell("Lord Ahmad of Wimbledon, Minister of State"), {
        name: "Lord Ahmad of Wimbledon",
        title: "Minister of State",
    });
});

test("UK date cells are read day first, in several formats", () => {
    assert.equal(parseUkDate("11/11/2024"), "2024-11-11");
    assert.equal(parseUkDate("3/2/15"), "2015-02-03");
    assert.equal(parseUkDate("2024-11-11"), "2024-11-11");
    assert.equal(parseUkDate("11-Nov-24"), "2024-11-11");
    assert.equal(parseUkDate("29 May 2011"), "2011-05-29");
    assert.equal(parseUkDate("31/02/2024"), null);
    assert.equal(parseUkDate("2024-06-31"), null);
    assert.equal(parseUkDate("Nil return"), null);
});

test("free-text destinations claim a city only for a single country", () => {
    const baku = capital("AZE", "Baku");
    assert.equal(cityCandidateOf("Baku, Azerbaijan"), "Baku");
    assert.equal(cityCandidateOf("Washington, D.C., United States of America"), "Washington");

    const single = placesOf("Baku, Azerbaijan", "GBR", {
        cities: cities({ "AZE:Baku": baku }),
        places,
    });
    assert.deepEqual(single, [baku]);

    const tour = placesOf("South Korea, Seoul and Japan, Osaka and Tokyo", "GBR", {
        cities: cities(),
        places,
    });
    assert.deepEqual(
        tour.map((place) => [place.countryCode, place.precision]),
        [
            ["KOR", "country"],
            ["JPN", "country"],
        ]
    );
    assert.deepEqual(
        placesOf("Regina, Saskatchewan, Canada", "CAN", { cities: cities(), places }),
        []
    );
});

test("Canadian rows keep ministers, not deputy ministers or staff", () => {
    assert.ok(isMinisterTitle("Minister of Foreign Affairs"));
    assert.ok(isMinisterTitle("Prime Minister"));
    assert.ok(isMinisterTitle("Deputy Prime Minister and Minister of Finance"));
    assert.ok(!isMinisterTitle("Deputy Minister"));
    assert.ok(!isMinisterTitle("Chief of Staff, Minister's Office"));
    assert.ok(!isMinisterTitle("Photographer to the Prime Minister"));
    assert.ok(!isMinisterTitle("Chief Administrator"));
    assert.ok(
        !isMinisterTitle(
            "Minister (Economic) and Deputy Head of Mission, United States (Washington D.C.)"
        )
    );
    assert.ok(!isMinisterTitle("Minister, Political Affairs (Washington DC)"));
    assert.equal(normalizeCanadianName("Bérubé, Paul-Claude"), "Paul-Claude Bérubé");
    assert.equal(normalizeCanadianName("The Hon. Mélanie Joly, P.C., M.P."), "Mélanie Joly");
});

test("Nepal MoFA headlines give the office, destination and dates", () => {
    assert.ok(
        isOutboundVisit(
            "Press Release on the Official Visit of the Rt. Hon. Vice President to Qatar"
        )
    );
    assert.ok(
        !isOutboundVisit(
            "Press Release on the official visit of Foreign Minister of Mongolia to Nepal"
        )
    );
    assert.ok(
        !isOutboundVisit("Foreign Secretary’s Participation in LDC graduation Meeting in Doha")
    );

    const dayTwo = claimsFromPressItem(
        {
            body: "Visit ... June 15, 2026, 07:17 AM The Foreign Minister met ...",
            published: "June 15, 2026",
            title: "Visit of Hon. Minister for Foreign Affairs of Nepal to People's Republic of China - Day 2",
            url: "https://mofa.gov.np/content/1831/",
        },
        places
    );
    assert.ok(Array.isArray(dayTwo));
    assert.equal(dayTwo[0].destination.countryCode, "CHN");
    assert.equal(dayTwo[0].startDate, "2026-06-14");
    assert.equal(dayTwo[0].traveller.portfolio, "foreign_affairs");
    assert.equal(dayTwo[0].traveller.name, null);

    const announced = claimsFromPressItem(
        {
            body: "The Vice President will pay an official visit to Qatar.",
            published: "March 3, 2026",
            title: "Press Release on the Official Visit of the Rt. Hon. Vice President to Qatar",
            url: "https://mofa.gov.np/content/1800/",
        },
        places
    );
    assert.ok(Array.isArray(announced));
    assert.deepEqual(
        [announced[0].datePrecision, announced[0].startDate, announced[0].endDate],
        ["month", "2026-03-01", "2026-03-31"]
    );
});

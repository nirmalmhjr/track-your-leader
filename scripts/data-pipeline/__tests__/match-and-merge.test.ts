import assert from "node:assert/strict";
import { test } from "node:test";

import type { Place } from "@/types/travel.types";

import { matchTravellers } from "../extract/travellers.match";
import { mergeClaims } from "../extract/trips.merge";
import { isAbroad } from "../pipeline";
import type { OfficialDraft, TripClaim } from "../types";

const TODAY = "2026-10-04";

const place = (countryCode: string, city: string, precision?: "country"): Place => ({
    city,
    coordinates: [0, 0],
    countryCode,
    region: "Asia",
    ...(precision ? { precision } : {}),
});

const claim = (
    overrides: Partial<TripClaim> & Pick<TripClaim, "source" | "startDate">
): TripClaim => ({
    datePrecision: "day",
    destination: place("CHN", "Beijing", "country"),
    endDate: overrides.startDate,
    engagements: [],
    eventName: null,
    purpose: null,
    sourceRef: { label: overrides.source, url: `https://example.org/${overrides.source}` },
    statusHint: null,
    traveller: {
        categories: [],
        countryCode: "NPL",
        familyName: null,
        name: null,
        portfolio: null,
        title: null,
        wikidataId: null,
    },
    type: "other",
    ...overrides,
});

const draft = (overrides: Partial<OfficialDraft>): OfficialDraft => ({
    aliases: [],
    countryCode: "NPL",
    name: "Someone",
    positions: [],
    sources: [],
    wikidataId: null,
    ...overrides,
});

test("the same trip from several sources becomes one trip with the best details", () => {
    const trips = mergeClaims(
        [
            claim({ endDate: "2018-06-24", source: "colt", startDate: "2018-06-19" }),
            claim({
                destination: place("CHN", "Beijing"),
                endDate: "2018-06-22",
                purpose: "Official visit",
                source: "wikipedia",
                startDate: "2018-06-19",
                type: "official_visit",
            }),
            claim({
                destination: place("CHN", "Lhasa"),
                endDate: "2018-06-24",
                source: "wikipedia",
                startDate: "2018-06-23",
            }),
        ],
        "kp-sharma-oli"
    );
    assert.equal(trips.length, 1);
    const [trip] = trips;
    assert.equal(trip.id, "kp-sharma-oli--2018-06-19--CHN");
    assert.equal(trip.endDate, "2018-06-24");
    assert.equal(trip.destination.city, "Beijing");
    assert.equal(trip.purpose, "Official visit");
    assert.equal(trip.type, "official_visit");
    assert.equal(trip.sources.length, 2);
});

test("a month-only claim joins an overlapping trip but never stretches it", () => {
    const trips = mergeClaims(
        [
            claim({ endDate: "2026-06-17", source: "wikipedia", startDate: "2026-06-14" }),
            claim({
                datePrecision: "month",
                endDate: "2026-06-30",
                source: "nepal-mofa",
                startDate: "2026-06-01",
            }),
            claim({ endDate: "2026-09-02", source: "colt", startDate: "2026-09-01" }),
        ],
        "x"
    );
    assert.deepEqual(
        trips.map((trip) => [trip.startDate, trip.endDate, trip.sources.length]),
        [
            ["2026-06-14", "2026-06-17", 2],
            ["2026-09-01", "2026-09-02", 1],
        ]
    );
});

test("travellers are matched by id, name, family name and office, or become new officials", async () => {
    const oli = draft({
        aliases: ["K. P. Sharma Oli"],
        name: "Khadga Prasad Sharma Oli",
        positions: [
            {
                categories: ["head_of_government"],
                endDate: "2021-07-13",
                ministry: null,
                portfolio: null,
                startDate: "2018-02-15",
                title: "Prime Minister of Nepal",
            },
        ],
        wikidataId: "Q367890",
    });
    const minister = draft({
        name: "Shisir Khanal",
        positions: [
            {
                categories: ["minister"],
                endDate: null,
                ministry: null,
                portfolio: "foreign_affairs",
                startDate: "2026-03-01",
                title: "Minister for Foreign Affairs",
            },
        ],
    });
    const traveller = (hint: Partial<TripClaim["traveller"]>): TripClaim["traveller"] => ({
        categories: [],
        countryCode: "NPL",
        familyName: null,
        name: null,
        portfolio: null,
        title: null,
        wikidataId: null,
        ...hint,
    });

    const byId = claim({
        source: "wikipedia",
        startDate: "2019-01-01",
        traveller: traveller({ wikidataId: "Q367890" }),
    });
    const byAlias = claim({
        source: "colt",
        startDate: "2019-02-01",
        traveller: traveller({ name: "K.P. Sharma Oli" }),
    });
    const byFamily = claim({
        source: "colt",
        startDate: "2019-03-01",
        traveller: traveller({
            categories: ["head_of_government"],
            familyName: "Oli",
            name: "Kay Oli",
        }),
    });
    const bySpellingAndOffice = claim({
        source: "historian",
        startDate: "2019-04-01",
        traveller: traveller({ categories: ["head_of_government"], name: "Khadga Prashad Olee" }),
    });
    const byOffice = claim({
        source: "nepal-mofa",
        startDate: "2026-06-14",
        traveller: traveller({ categories: ["minister"], portfolio: "foreign_affairs" }),
    });
    const stranger = claim({
        source: "gov-uk",
        startDate: "2015-05-05",
        traveller: traveller({
            categories: ["minister"],
            name: "New Person",
            title: "Minister of State",
        }),
    });
    const nobody = claim({
        source: "nepal-mofa",
        startDate: "1990-01-01",
        traveller: traveller({ categories: ["head_of_state"] }),
    });

    const result = await matchTravellers(
        [byId, byAlias, byFamily, bySpellingAndOffice, byOffice, stranger, nobody],
        [oli, minister],
        new Map(),
        TODAY
    );
    assert.equal(result.draftOf.get(byId), oli);
    assert.equal(result.draftOf.get(byAlias), oli);
    assert.equal(result.draftOf.get(byFamily), oli);
    assert.equal(result.draftOf.get(bySpellingAndOffice), oli);
    assert.equal(result.draftOf.get(byOffice), minister);
    assert.deepEqual(result.unmatched, [nobody]);
    assert.equal(result.newDrafts.length, 1);
    const [created] = result.newDrafts;
    assert.equal(created.name, "New Person");
    assert.deepEqual(created.positions[0], {
        categories: ["minister"],
        endDate: "2015-05-05",
        ministry: null,
        portfolio: null,
        startDate: "2015-05-05",
        title: "Minister of State",
    });
});

test("right after a change of government, exact terms pick the office holder", async () => {
    const leader = (name: string, startDate: string, endDate: string | null) =>
        draft({
            countryCode: "CAN",
            name,
            positions: [
                {
                    categories: ["head_of_government"],
                    endDate,
                    ministry: null,
                    portfolio: null,
                    startDate,
                    title: "Prime Minister of Canada",
                },
            ],
            wikidataId: name,
        });
    const outgoing = leader("John Diefenbaker", "1957-06-21", "1963-04-22");
    const incoming = leader("Lester B. Pearson", "1963-04-22", "1968-04-20");
    const visit = claim({
        source: "historian-visits",
        startDate: "1963-05-10",
        traveller: {
            categories: ["head_of_government"],
            countryCode: "CAN",
            familyName: null,
            name: "Pearson",
            portfolio: null,
            title: "Prime Minister",
            wikidataId: null,
        },
    });
    const result = await matchTravellers([visit], [outgoing, incoming], new Map(), TODAY);
    assert.equal(result.draftOf.get(visit), incoming);
});

test("an office named alone goes to the holder whose term is known to cover the date", async () => {
    const holder = (name: string, startDate: string | null, endDate: string | null) =>
        draft({
            countryCode: "IND",
            name,
            positions: [
                {
                    categories: ["deputy_leader"],
                    endDate,
                    ministry: null,
                    portfolio: null,
                    startDate,
                    title: "Vice President",
                },
            ],
        });
    const ansari = holder("Mohammad Hamid Ansari", "2007-08-11", "2017-08-10");
    // Wikidata's end date for Patel is a typo; a current cabinet member's start is unknown.
    const patel = holder("Sardar Vallabhbhai Patel", "1947-08-15", "6767-12-15");
    const current = holder("Someone Current", null, null);
    const visit = claim({
        source: "india-mea",
        startDate: "2013-01-14",
        traveller: {
            categories: ["deputy_leader"],
            countryCode: "IND",
            familyName: null,
            name: null,
            portfolio: null,
            title: "Vice President",
            wikidataId: null,
        },
    });
    const result = await matchTravellers([visit], [patel, current, ansari], new Map(), TODAY);
    assert.equal(result.draftOf.get(visit), ansari);
});

test("a surname alone matches the one official of that country with it and the role", async () => {
    const president = (name: string, startDate: string, endDate: string) =>
        draft({
            countryCode: "VEN",
            name,
            positions: [
                {
                    categories: ["head_of_state", "head_of_government"],
                    endDate,
                    ministry: null,
                    portfolio: null,
                    startDate,
                    title: "President of Venezuela",
                },
            ],
            wikidataId: name,
        });
    // Wikidata records only Betancourt's first term; the visit is in his second.
    const betancourt = president("Rómulo Betancourt", "1945-10-19", "1948-02-17");
    const leoni = president("Raúl Leoni", "1964-03-13", "1969-03-11");
    const visit = (name: string) =>
        claim({
            source: "historian-visits",
            startDate: "1963-02-19",
            traveller: {
                categories: ["head_of_state"],
                countryCode: "VEN",
                familyName: null,
                name,
                portfolio: null,
                title: "President",
                wikidataId: null,
            },
        });
    const bySurname = visit("Betancourt");
    const unknown = visit("Ramírez");
    const result = await matchTravellers(
        [bySurname, unknown],
        [betancourt, leoni],
        new Map(),
        TODAY
    );
    assert.equal(result.draftOf.get(bySurname), betancourt);
    // Nobody by that surname: a new official, never another president.
    assert.equal(result.draftOf.get(unknown)?.name, "Ramírez");
});

test("a family name nobody holds isn't given to whoever held the office", async () => {
    // A current minister whose start date the cabinet list doesn't give.
    const mehta = draft({
        name: "Nisha Mehta",
        positions: [
            {
                categories: ["minister"],
                endDate: null,
                ministry: null,
                portfolio: "health",
                startDate: null,
                title: "Minister of Health and Population",
            },
        ],
    });
    const delegate = (familyName: string) =>
        claim({
            datePrecision: "month",
            endDate: "2002-05-31",
            source: "who-assembly",
            startDate: "2002-05-01",
            traveller: {
                categories: ["minister"],
                countryCode: "NPL",
                familyName,
                name: null,
                portfolio: "health",
                title: "Minister of Health",
                wikidataId: null,
            },
        });
    const matches = await matchTravellers(
        [delegate("Bhandari"), delegate("Mehta")],
        [mehta],
        new Map(),
        TODAY
    );
    assert.equal(matches.draftOf.size, 1);
    assert.equal(matches.unmatched.length, 1);
    assert.equal(matches.unmatched[0]?.traveller.familyName, "Bhandari");
});

test("trips at home aren't international travel", () => {
    const abroad = claim({ source: "wikipedia", startDate: "2023-09-19" });
    const home = claim({
        destination: place("NPL", "Kathmandu"),
        source: "un-general-debate",
        startDate: "2023-09-19",
    });
    assert.equal(isAbroad(abroad), true);
    assert.equal(isAbroad(home), false);
});

test("a visit naming a leader by one name goes to whoever held the office then", async () => {
    const leader = (
        name: string,
        category: "head_of_state" | "head_of_government",
        startDate: string,
        endDate: string
    ) =>
        draft({
            name,
            positions: [
                {
                    categories: [category],
                    endDate,
                    ministry: null,
                    portfolio: null,
                    startDate,
                    title:
                        category === "head_of_state" ? "King of Nepal" : "Prime Minister of Nepal",
                },
            ],
            wikidataId: name,
        });
    const mahendra = leader("Mahendra I of Nepal", "head_of_state", "1955-03-13", "1972-01-31");
    const birendra = leader("Birendra of Nepal", "head_of_state", "1972-01-31", "2001-06-01");
    const matrika = leader(
        "Matrika Prasad Koirala",
        "head_of_government",
        "1951-11-16",
        "1952-08-14"
    );
    const bp = leader("B. P. Koirala", "head_of_government", "1959-05-27", "1960-12-15");
    const visit = (name: string, category: "head_of_state" | "head_of_government", date: string) =>
        claim({
            source: "historian-visits",
            startDate: date,
            traveller: {
                categories: [category],
                countryCode: "NPL",
                familyName: null,
                name,
                portfolio: null,
                title: null,
                wikidataId: null,
            },
        });
    const claims = [
        visit("Birendra", "head_of_state", "1983-12-05"),
        visit("Mahendra", "head_of_state", "1960-04-27"),
        visit("Koirala", "head_of_government", "1960-09-22"),
    ];

    const { draftOf, newDrafts } = await matchTravellers(
        claims,
        [mahendra, birendra, matrika, bp],
        new Map(),
        TODAY
    );
    assert.equal(newDrafts.length, 0);
    assert.deepEqual(
        claims.map((entry) => draftOf.get(entry)?.name),
        ["Birendra of Nepal", "Mahendra I of Nepal", "B. P. Koirala"]
    );
});

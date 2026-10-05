import assert from "node:assert/strict";
import { test } from "node:test";

import type { Place } from "@/types/travel.types";

import { matchTravellers } from "../extract/travellers.match";
import { mergeClaims } from "../extract/trips.merge";
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
        [byId, byAlias, byFamily, byOffice, stranger, nobody],
        [oli, minister],
        new Map(),
        TODAY
    );
    assert.equal(result.draftOf.get(byId), oli);
    assert.equal(result.draftOf.get(byAlias), oli);
    assert.equal(result.draftOf.get(byFamily), oli);
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

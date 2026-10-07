import assert from "node:assert/strict";
import { test } from "node:test";

import type { CountryCode } from "@/types/geo.types";
import type { Place } from "@/types/travel.types";

import { claimFromKremlinEvent } from "../extract/claims/kremlin.claims";
import type { PlaceIndex } from "../extract/places.resolve";
import { parseKremlinList } from "../sources/kremlin";

const capital = (countryCode: CountryCode, city: string): Place => ({
    city,
    coordinates: [0, 0],
    countryCode,
    region: "Europe",
});
const places: PlaceIndex = {
    capitals: new Map([
        ["EGY", capital("EGY", "Cairo")],
        ["IND", capital("IND", "New Delhi")],
        ["RUS", capital("RUS", "Moscow")],
        ["USA", capital("USA", "Washington, D.C.")],
    ]),
    codeByItem: new Map(),
    itemByCode: new Map(),
};
const event = (title: string, place: string | null) => ({
    date: "2019-10-23",
    place,
    title,
    url: "http://en.kremlin.ru/events/president/news/61879",
});

test("the Kremlin's event list gives each event's title, date and place", () => {
    const html = `
<div class="hentry h-entry hentry_event"><h3 class="hentry__title"><a href="/events/president/news/61879">
<span class="entry-title p-name">Meeting with President of Egypt Abdel Fattah el-Sisi</span>
<span class="hentry__meta"><time class="published dt-published" datetime="2019-10-23">October 23, 2019, 10:45</time>
<span class="hentry__location p-location">Sochi</span></span></a></h3></div>
<a href="/events/president/news/page/2" rel="next">Previous</a>`;
    assert.deepEqual(parseKremlinList(html), {
        events: [event("Meeting with President of Egypt Abdel Fattah el-Sisi", "Sochi")],
        hasNext: true,
    });
});

test("a meeting puts the foreign leader where it took place", () => {
    const where = (title: string, place: string | null) => {
        const claim = claimFromKremlinEvent(event(title, place), places);
        return claim && !("reason" in claim)
            ? `${claim.traveller.countryCode} ${claim.traveller.categories[0]} -> ${claim.destination.countryCode}`
            : claim;
    };
    assert.equal(
        where("Meeting with President of Egypt Abdel Fattah el-Sisi", "Sochi"),
        "EGY head_of_state -> RUS"
    );
    assert.equal(
        where("Conversation with Prime Minister of Malaysia Anwar Ibrahim", "New Delhi"),
        "MYS head_of_government -> IND"
    );
    // Calls, envoys, Russian officials and meetings in the visitor's own country aren't their trips.
    assert.equal(
        where("Telephone conversation with President of France Emmanuel Macron", null),
        null
    );
    assert.equal(
        where("Meeting with US President's Special Envoy Steve Witkoff", "The Kremlin, Moscow"),
        null
    );
    assert.equal(
        where("Meeting with Governor of St Petersburg Alexander Beglov", "St Petersburg"),
        null
    );
    assert.equal(where("Meeting with President of Egypt Abdel Fattah el-Sisi", "Cairo"), null);
});

test("older Kremlin events are sentences: 'President Vladimir Putin met with …'", () => {
    const claim = claimFromKremlinEvent(
        event(
            "President Vladimir Putin met with President of Egypt Hosni Mubarak.",
            "The Kremlin, Moscow"
        ),
        places
    );
    assert.equal(
        claim && !("reason" in claim)
            ? `${claim.traveller.countryCode} -> ${claim.destination.countryCode}`
            : claim,
        "EGY -> RUS"
    );
});

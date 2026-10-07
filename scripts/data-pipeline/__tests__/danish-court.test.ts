import assert from "node:assert/strict";
import { test } from "node:test";

import type { CountryCode } from "@/types/geo.types";
import type { Place } from "@/types/travel.types";

import { claimsFromDanishVisit } from "../extract/claims/danish-court.claims";
import type { PlaceIndex } from "../extract/places.resolve";
import { type DanishVisit, parseDanishVisits } from "../sources/danish-court";

const capital = (countryCode: CountryCode, city: string): Place => ({
    city,
    coordinates: [0, 0],
    countryCode,
    region: "Europe",
});
const places: PlaceIndex = {
    capitals: new Map([
        ["DNK", capital("DNK", "Copenhagen")],
        ["ITA", capital("ITA", "Rome")],
        ["KEN", capital("KEN", "Nairobi")],
        ["NOR", capital("NOR", "Oslo")],
        ["VNM", capital("VNM", "Hanoi")],
    ]),
    codeByItem: new Map(),
    itemByCode: new Map(),
};
const NAMES: Readonly<Record<string, CountryCode>> = {
    italien: "ITA",
    kenya: "KEN",
    norge: "NOR",
    vietnam: "VNM",
};
const context = { countryOf: (name: string) => NAMES[name.trim().toLowerCase()] ?? null, places };
const visit = (overrides: Partial<DanishVisit>): DanishVisit => ({
    dates: null,
    kind: "outgoing",
    person: null,
    places: "Norge",
    year: 2024,
    ...overrides,
});
const who = (overrides: Partial<DanishVisit>) => {
    const result = claimsFromDanishVisit(visit(overrides), context);
    return Array.isArray(result)
        ? result.map(
              (claim) =>
                  `${claim.traveller.wikidataId ?? `${claim.traveller.countryCode} head of state`} -> ${claim.destination.countryCode} ${claim.startDate}`
          )
        : result;
};

test("the Royal House's lists: year lines, and official visits with who went", () => {
    const html = `
<div class="accordion__container__item"><h3 class="accordion__container__item__title">Udgående statsbesøg</h3>
<div class="accordion__container__item__content"><p>2024 Norge</p><p>2008 Tanzania og Mexico</p></div></div>
<div class="accordion__container__item"><h3 class="accordion__container__item__title">Besøg i udlandet</h3>
<div class="accordion__container__item__content"><p><strong>2025<br></strong><em>H.M. Dronningen<br></em><a href="/x">Kenya (10.-11. december)</a></p></div></div>`;
    assert.deepEqual(parseDanishVisits(html), [
        { dates: null, kind: "outgoing", person: null, places: "Norge", year: 2024 },
        { dates: null, kind: "outgoing", person: null, places: "Tanzania og Mexico", year: 2008 },
        {
            dates: "10.-11. december",
            kind: "official",
            person: "H.M. Dronningen",
            places: "Kenya",
            year: 2025,
        },
    ]);
});

test("visits abroad are the monarch's: Margrethe II until 2024, Frederik X since", () => {
    assert.deepEqual(who({ places: "Norge", year: 2024 }), ["Q1004037 -> NOR 2024-01-01"]);
    assert.deepEqual(who({ places: "Italien", year: 2017 }), ["Q102139 -> ITA 2017-01-01"]);
    assert.deepEqual(
        who({
            dates: "26.-29. oktober",
            kind: "official",
            person: "H.M. Dronning Margrethe (daværende regent)",
            places: "Rom, Italien",
            year: 2017,
        }),
        ["Q102139 -> ITA 2017-10-26"]
    );
    // Since 2024 "H.M. Dronningen" is Queen Mary, a consort.
    assert.equal(
        who({ kind: "official", person: "H.M. Dronningen", places: "Kenya", year: 2025 }),
        null
    );
    assert.equal(
        who({
            dates: "2.-3. november) UDSKUDT",
            kind: "official",
            person: "H.M. Kongen",
            places: "Norge",
            year: 2020,
        }),
        null
    );
});

test("state visits to Denmark are trips of the visiting head of state", () => {
    assert.deepEqual(
        who({ kind: "incoming", places: "Den Socialistiske Republik Vietnam", year: 2026 }),
        ["VNM head of state -> DNK 2026-01-01"]
    );
});

import assert from "node:assert/strict";
import { test } from "node:test";

import {
    continentFill,
    getMapContinent,
} from "@/features/travel-explorer/utils/map-continents.utils";
import { getCountryReference } from "@/lib/geo/country-reference";

const continentOf = (alpha3: string) => getMapContinent(getCountryReference(alpha3) ?? null);

test("getMapContinent splits the Americas and follows the region data elsewhere", () => {
    assert.equal(continentOf("USA"), "north-america");
    assert.equal(continentOf("PAN"), "north-america");
    assert.equal(continentOf("CUB"), "north-america");
    assert.equal(continentOf("BRA"), "south-america");
    assert.equal(continentOf("NPL"), "asia");
    assert.equal(continentOf("RUS"), "europe");
    assert.equal(continentOf("KEN"), "africa");
    assert.equal(continentOf("AUS"), "oceania");
    assert.equal(continentOf("ATA"), null);
    assert.equal(getMapContinent(null), null);
});

test("continentFill falls back to plain land where a theme has no continent colours", () => {
    assert.equal(continentFill("asia"), "var(--map-land-asia, var(--map-land))");
    assert.equal(continentFill(null), "var(--map-land)");
});

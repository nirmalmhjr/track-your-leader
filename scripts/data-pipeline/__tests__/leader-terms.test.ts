import assert from "node:assert/strict";
import { test } from "node:test";

import type { RoleCategory } from "@/types/travel.types";

import {
    addTerritoryMonarchs,
    closeSupersededLeaderTerms,
    dropBareGovernorGeneral,
} from "../extract/leaders.terms";
import type { PositionDraft } from "../types";

const term = (
    title: string,
    startDate: string,
    categories: RoleCategory[] = ["head_of_government"]
): PositionDraft => ({
    categories,
    endDate: null,
    ministry: null,
    portfolio: null,
    startDate,
    title,
});
const holder = (...positions: PositionDraft[]) => ({ positions });

test("an open generic term ends when someone else takes the office", () => {
    // Thailand: acting PM on the country's item, then the next PM on the office.
    const acting = holder(term("Head of government", "2025-07-03"));
    const next = holder(term("Prime Minister of Thailand", "2025-09-07"));
    assert.equal(closeSupersededLeaderTerms([acting, next]), 1);
    assert.equal(acting.positions[0]?.endDate, "2025-09-07");
    assert.equal(next.positions[0]?.endDate, null);
});

test("an open named term ends at a later generic term, but a dual office never does", () => {
    // North Korea: the Premier's office still names the predecessor.
    const premier = holder(term("Premier of North Korea", "2020-08-13"));
    const successor = holder(term("Head of government", "2024-12-01"));
    closeSupersededLeaderTerms([premier, successor]);
    assert.equal(premier.positions[0]?.endDate, "2024-12-01");

    // Sri Lanka: the President heads the government beside the Prime Minister.
    const president = holder(
        term("President of Sri Lanka", "2024-09-23", ["head_of_state", "head_of_government"])
    );
    const pm = holder(term("Head of government", "2024-09-24"));
    closeSupersededLeaderTerms([president, pm]);
    assert.equal(president.positions[0]?.endDate, null);
});

test("an open term ends when someone else takes the same office", () => {
    // Sudan: the acting PM's term was never closed when the next PM took office.
    const acting = holder(term("Prime Minister of Sudan", "2022-01-19"));
    const next = holder(term("Prime Minister of Sudan", "2025-05-19"));
    closeSupersededLeaderTerms([acting, next]);
    assert.equal(acting.positions[0]?.endDate, "2025-05-19");
    assert.equal(next.positions[0]?.endDate, null);
});

test("members of a collective office don't end each other's terms", () => {
    const member = (startDate: string) =>
        holder(term("Member of the Swiss Federal Council", startDate, ["head_of_state"]));
    const earlier = member("2018-01-01");
    const later = member("2024-01-01");
    assert.equal(closeSupersededLeaderTerms([earlier, later]), 0);
});

test("terms only end at a successor in the same country", () => {
    // Charles III's Canadian reign isn't ended by a later head of state of the United Kingdom.
    const kingdom = term("Head of state", "2022-09-08", ["head_of_state"]);
    const canada = {
        ...term("Monarch of Canada", "2022-09-08", ["head_of_state"]),
        countryCode: "CAN",
    };
    const king = { countryCode: "GBR", positions: [kingdom, canada] };
    const other = {
        countryCode: "GBR",
        positions: [term("Head of state", "2030-01-01", ["head_of_state"])],
    };
    closeSupersededLeaderTerms([king, other]);
    assert.equal(kingdom.endDate, "2030-01-01");
    assert.equal(canada.endDate, null);
});

test("a territory's head of state is its sovereign's monarch", () => {
    const reign = { ...term("Monarch of the United Kingdom", "2022-09-08", ["head_of_state"]) };
    const king = { countryCode: "GBR", positions: [reign] };
    assert.equal(addTerritoryMonarchs([king], { BMU: "GBR" }), 1);
    assert.deepEqual(king.positions[1], { ...reign, countryCode: "BMU" });
    // Run again: the territory already has that term.
    assert.equal(addTerritoryMonarchs([king], { BMU: "GBR" }), 0);
    // Someone else's head-of-state terms aren't copied.
    const president = {
        countryCode: "FRA",
        positions: [term("President", "2017-05-14", ["head_of_state"])],
    };
    assert.equal(addTerritoryMonarchs([president], { BMU: "GBR" }), 0);
});

test("a cabinet list's bare governor-general title gives way to Wikidata's term", () => {
    // Canada: the CIA still lists Mary Simon, whose term Wikidata ends when the next one began.
    const named = {
        ...term("Governor General of Canada", "2021-07-26", ["governor_general"]),
        endDate: "2026-06-07",
    };
    const simon = {
        positions: [named, term("Governor General", "2026-10-05", ["governor_general"])],
    };
    const listedOnly = {
        positions: [term("Governor General", "2026-10-05", ["governor_general"])],
    };
    assert.equal(dropBareGovernorGeneral([simon, listedOnly]), 1);
    assert.deepEqual(simon.positions, [named]);
    assert.equal(listedOnly.positions.length, 1);
});

test("a governor-general's term ends when the next one takes the office", () => {
    const earlier = holder(term("Governor-General of Tuvalu", "2021-09-29", ["governor_general"]));
    const next = holder(term("Governor-General of Tuvalu", "2026-09-30", ["governor_general"]));
    closeSupersededLeaderTerms([earlier, next]);
    assert.equal(earlier.positions[0]?.endDate, "2026-09-30");
});

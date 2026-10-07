import assert from "node:assert/strict";
import { test } from "node:test";

import type { RoleCategory } from "@/types/travel.types";

import { closeSupersededLeaderTerms } from "../extract/leaders.terms";
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

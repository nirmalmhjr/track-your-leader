import assert from "node:assert/strict";
import { test } from "node:test";

import {
    overriddenName,
    removeExcludedPositions,
    withoutExcludedPositions,
} from "../extract/leaders.overrides";
import { closeSupersededLeaderTerms } from "../extract/leaders.terms";
import type { PositionDraft } from "../types";

const term = (title: string, startDate: string, endDate: string | null): PositionDraft => ({
    categories: ["head_of_government"],
    endDate,
    ministry: null,
    portfolio: null,
    startDate,
    title,
});

test("a known-wrong Wikidata label gives way to the corrected name", () => {
    assert.equal(overriddenName("Q98053664"), "Mark Phillips");
    assert.equal(overriddenName("Q150080"), "Mikhail Fradkov");
    assert.equal(overriddenName("Q1"), null);
    assert.equal(overriddenName(null), null);
});

test("Belousov's acting term no longer ends Mishustin's", () => {
    const mishustin = () => ({
        countryCode: "RUS",
        positions: [term("Prime Minister of Russia", "2020-01-16", null)],
        wikidataId: "Q4298520",
    });
    const belousov = {
        countryCode: "RUS",
        positions: [term("Prime Minister of Russia", "2020-04-30", "2020-05-19")],
        wikidataId: "Q4082839",
    };

    // Read as a successor, the acting term would close Mishustin's at its start.
    const unguarded = mishustin();
    closeSupersededLeaderTerms([unguarded, belousov]);
    assert.equal(unguarded.positions[0].endDate, "2020-04-30");

    const guarded = mishustin();
    const kept = [guarded, belousov].flatMap((record) => withoutExcludedPositions(record) ?? []);
    closeSupersededLeaderTerms(kept);
    assert.equal(guarded.positions[0].endDate, null);
});

test("stray titles folded into Abbas's record are removed in place, his presidency kept", () => {
    const abbas = {
        positions: [
            term("President of Palestine", "2005-01-15", null),
            term("President [nb 7]", "2013-09-26", "2013-09-26"),
            term("Head of state", "2013-03-14", "2025-05-10"),
        ],
        wikidataId: "Q127998",
    };
    const { positions } = abbas;

    assert.equal(removeExcludedPositions([abbas]), 2);
    assert.equal(abbas.positions, positions);
    assert.deepEqual(
        abbas.positions.map((position) => position.title),
        ["President of Palestine"]
    );
});

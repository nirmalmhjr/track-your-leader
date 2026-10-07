import assert from "node:assert/strict";
import { test } from "node:test";

import { uniquePositions } from "../extract/officials.extract";
import { mergeNameTwins } from "../extract/people.assemble";
import type { OfficialDraft, PositionDraft } from "../types";

const position = (
    title: string,
    startDate: string | null,
    endDate: string | null
): PositionDraft => ({
    categories: ["minister"],
    endDate,
    ministry: null,
    portfolio: null,
    startDate,
    title,
});
const draft = (
    name: string,
    wikidataId: string | null,
    positions: PositionDraft[] = []
): OfficialDraft => ({
    aliases: [],
    countryCode: "AFG",
    name,
    positions,
    sources: [],
    wikidataId,
});

test("a term two sources report is kept once; separate terms in one office stay", () => {
    const minister = position("Minister of External Relations", "2020-10-01", null);
    const kept = uniquePositions([
        minister,
        { ...minister },
        position("King of Nepal", "2001-06-04", "2008-05-28"),
        position("King of Nepal", "1950-11-07", "1951-02-18"),
    ]);
    assert.equal(kept.length, 3);

    // The same term, once as current and once with an unknown end: the current one stays.
    const [only, ...rest] = uniquePositions([
        {
            ...position("Member of the National Assembly of Angola", "2019-10-29", null),
            undated: true,
        },
        position("Member of the National Assembly of Angola", "2019-10-29", null),
    ]);
    assert.equal(rest.length, 0);
    assert.equal(only?.undated, undefined);
});

test("an official known only by name is folded into their identified twin", () => {
    const identified = draft("Sirajuddin Haqqani", "Q2246940", [
        position("Minister of Interior", "2021-09-07", null),
    ]);
    const stub = draft("Sirajuddin Haqqani", null, [
        position("Acting Minister of Interior", null, null),
    ]);
    const kept = mergeNameTwins([identified, stub], []);
    assert.deepEqual(kept, [identified]);
    assert.equal(identified.positions.length, 2);

    // Two identified people sharing a name: the stub can't tell which, so it stays.
    const other = draft("Kim Beazley", "Q2266155");
    const son = draft("Kim Beazley", "Q304561");
    const unknown = draft("Kim Beazley", null);
    assert.equal(mergeNameTwins([other, son, unknown], []).length, 3);
});

import assert from "node:assert/strict";
import { test } from "node:test";

import { getPrimaryPosition } from "@/lib/travel/officials.utils";
import type { Official, Position } from "@/types/travel.types";

const position = (overrides: Partial<Position>): Position => ({
    categories: ["legislator"],
    endDate: "2002-10-17",
    id: "p",
    ministry: null,
    portfolio: null,
    startDate: null,
    title: "Member of the Bundestag",
    ...overrides,
});

const official = (positions: Position[]): Official => ({
    countryCode: "DEU",
    fullName: "Helmut Kohl",
    id: "helmut-kohl",
    party: null,
    photoUrl: null,
    positions,
    sources: [],
    summary: "",
    wikidataId: null,
});

test("a former official is described by their most senior office", () => {
    const chancellor = position({
        categories: ["head_of_government"],
        endDate: "1998-10-27",
        title: "Chancellor of Germany",
    });
    assert.equal(getPrimaryPosition(official([position({}), chancellor])), chancellor);
});

test("an office held today comes first, however junior", () => {
    const seat = position({ endDate: null, title: "Member of the Bundestag" });
    const chancellor = position({ categories: ["head_of_government"], title: "Chancellor" });
    assert.equal(getPrimaryPosition(official([seat, chancellor])), seat);
});

test("undated offices aren't taken for current ones", () => {
    const undated = position({ endDate: null, undated: true });
    const minister = position({ categories: ["minister"], title: "Minister of Finance" });
    assert.equal(getPrimaryPosition(official([undated, minister])), minister);
});

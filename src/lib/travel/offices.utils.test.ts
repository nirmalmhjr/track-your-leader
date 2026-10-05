import assert from "node:assert/strict";
import { test } from "node:test";

import {
    countTenure,
    getHeldOfficeKeys,
    groupOffices,
    groupPastTermsByYear,
} from "@/lib/travel/offices.utils";
import type { Official, Position } from "@/types/travel.types";

const position = (overrides: Partial<Position> & Pick<Position, "title">): Position => ({
    categories: ["minister"],
    endDate: null,
    id: overrides.title,
    ministry: null,
    portfolio: null,
    startDate: null,
    ...overrides,
});

const official = (id: string, positions: Position[]): Official => ({
    countryCode: "NPL",
    fullName: id,
    id,
    party: null,
    photoUrl: null,
    positions,
    sources: [],
    summary: "",
    wikidataId: null,
});

const officials = [
    official("finance-now", [
        position({ portfolio: "finance", startDate: "2024-07-15", title: "Minister of Finance" }),
    ]),
    official("finance-before", [
        position({
            endDate: "2024-07-15",
            portfolio: "finance",
            startDate: "2022-12-26",
            title: "Minister of Finance",
        }),
        position({
            endDate: "2018-02-15",
            portfolio: "finance",
            startDate: "2017-06-07",
            title: "minister of finance",
        }),
    ]),
    official("pm", [
        position({
            categories: ["head_of_government"],
            startDate: "2024-07-15",
            title: "Prime Minister",
        }),
    ]),
    official("foreign", [
        position({
            portfolio: "foreign_affairs",
            startDate: "2024-07-15",
            title: "Minister of Foreign Affairs",
        }),
    ]),
    official("abolished", [
        position({ endDate: "2015-01-01", startDate: "2013-01-01", title: "Minister of Peace" }),
    ]),
];

test("offices are ordered by group, seniority and portfolio, vacant ones last", () => {
    assert.deepEqual(
        groupOffices(officials).map((office) => [office.title, office.group]),
        [
            ["Prime Minister", "leadership"],
            ["Minister of Foreign Affairs", "ministers"],
            ["Minister of Finance", "ministers"],
            ["Minister of Peace", "vacant"],
        ]
    );
});

test("an office merges titles that differ only in case and counts each holder once", () => {
    const finance = groupOffices(officials).find((office) => office.key === "minister of finance");

    assert.ok(finance);
    assert.deepEqual(
        finance.current.map((term) => term.official.id),
        ["finance-now"]
    );
    assert.deepEqual(
        finance.past.map((term) => term.position.startDate),
        ["2022-12-26", "2017-06-07"]
    );
    assert.equal(finance.holderCount, 2);
});

test("tenure counts split officials holding an office today from former ones", () => {
    assert.deepEqual(countTenure(officials), { current: 3, former: 2 });
});

test("past terms are grouped by the year they ended, newest first", () => {
    assert.deepEqual(
        groupPastTermsByYear(officials).map(({ year, terms }) => [
            year,
            terms.map((term) => term.official.id),
        ]),
        [
            ["2024", ["finance-before"]],
            ["2018", ["finance-before"]],
            ["2015", ["abolished"]],
        ]
    );
});

test("an office stays held when its current holder is filtered out", () => {
    const formerOnly = officials.filter((entry) =>
        entry.positions.every((held) => held.endDate !== null)
    );
    const groups = (heldKeys?: ReadonlySet<string>) =>
        groupOffices(formerOnly, heldKeys).map((office) => [office.title, office.group]);

    assert.deepEqual(groups(), [
        ["Minister of Finance", "vacant"],
        ["Minister of Peace", "vacant"],
    ]);
    assert.deepEqual(groups(getHeldOfficeKeys(officials)), [
        ["Minister of Finance", "ministers"],
        ["Minister of Peace", "vacant"],
    ]);
});

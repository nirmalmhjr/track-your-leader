import assert from "node:assert/strict";
import { test } from "node:test";

import {
    getLeadingCategory,
    getOtherCurrentPositions,
    getPortfolioName,
    getPrimaryPosition,
    groupPositionsByOffice,
} from "@/lib/travel/officials.utils";
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

test("other current offices leave out the primary one, past offices and seats", () => {
    const pm = position({ categories: ["head_of_government"], endDate: null, title: "PM" });
    const defence = position({ categories: ["minister"], endDate: null, title: "Defence" });
    const seat = position({ endDate: null, title: "Member of the House" });
    const pastMinistry = position({ categories: ["minister"], title: "Home Affairs" });
    assert.deepEqual(getOtherCurrentPositions(official([pm, defence, seat, pastMinistry])), [
        defence,
    ]);
});

test("a former official holds no other current office", () => {
    assert.deepEqual(getOtherCurrentPositions(official([position({})])), []);
});

test("portfolio names drop the minister prefix", () => {
    assert.equal(getPortfolioName("Minister of Finance"), "Finance");
    assert.equal(getPortfolioName("Minister for the environment"), "Environment");
    assert.equal(getPortfolioName("Secretary of State"), "Secretary of State");
    assert.equal(getPortfolioName("Minister of "), "Minister of ");
});

test("the leading category is the most senior one", () => {
    assert.equal(
        getLeadingCategory(position({ categories: ["legislator", "regional_leader", "minister"] })),
        "minister"
    );
});

test("an office held more than once is one entry with every term", () => {
    const offices = groupPositionsByOffice([
        position({
            endDate: "2008-05-28",
            id: "p1",
            startDate: "2001-06-04",
            title: "King of Nepal",
        }),
        position({ endDate: "2001-01-01", id: "p2", startDate: "1995-01-01", title: "Minister" }),
        position({
            endDate: "1951-02-18",
            id: "p3",
            startDate: "1950-11-07",
            title: "King of Nepal",
        }),
    ]);
    assert.deepEqual(
        offices.map((office) => [
            office.title,
            office.terms.map((term) => term.id),
            office.isCurrent,
        ]),
        [
            ["King of Nepal", ["p1", "p3"], false],
            ["Minister", ["p2"], false],
        ]
    );
});

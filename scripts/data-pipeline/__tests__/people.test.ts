import assert from "node:assert/strict";
import { test } from "node:test";

import {
    classifyOffice,
    type Holding,
    type OfficeInfo,
    positionFromHolding,
} from "../extract/people.extract";
import { classifyTitle } from "../extract/roles";
import { parseQleverTsv } from "../sources/qlever";
import type { CountryContext } from "../types";

const nepal: CountryContext = {
    code: "NPL",
    headOfGovernmentOffice: "Q2099",
    headOfStateOffice: "Q2100",
    wikidataId: "Q837",
};

const office = (overrides: Partial<OfficeInfo>): OfficeInfo => ({
    isCapital: false,
    kinds: new Set(),
    label: "Some office",
    parentJurisdictions: new Set(),
    population: 0,
    ...overrides,
});

test("QLever rows keep ids, text and dates, and leave empty cells unbound", () => {
    const rows = parseQleverTsv(
        [
            "?person\t?label\t?start\t?end",
            '<http://www.wikidata.org/entity/Q42>\t"Douglas \\"D\\" Adams"@en\t"2001-05-11T00:00:00"^^<http://www.w3.org/2001/XMLSchema#dateTime>\t',
        ].join("\n")
    );
    assert.deepEqual(rows, [
        { end: undefined, label: 'Douglas "D" Adams', person: "Q42", start: "2001-05-11T00:00:00" },
    ]);
});

test("offices get roles from their titles first, then from their Wikidata class", () => {
    const role = (info: OfficeInfo, id = "Q1") => classifyOffice(id, info, nepal)?.categories[0];
    assert.equal(role(office({ label: "Prime Minister of Nepal" }), "Q2099"), "head_of_government");
    assert.equal(role(office({ label: "Minister of Health and Population" })), "minister");
    assert.equal(
        role(office({ kinds: new Set(["legislator"]), label: "Teachta Dála" })),
        "legislator"
    );
    assert.equal(
        role(office({ kinds: new Set(["judiciary"]), label: "Puisne judge" })),
        "judiciary"
    );
    // Not politically exposed: no recognised class and nothing in the title.
    assert.equal(
        role(office({ label: "President of the American Library Association" })),
        undefined
    );
});

test("city offices count only in capitals and cities of 100,000 people or more", () => {
    const mayor = (population: number, isCapital = false) =>
        classifyOffice("Q1", office({ isCapital, label: "Mayor of Somewhere", population }), nepal);
    assert.equal(mayor(2_500_000)?.categories[0], "local_leader");
    assert.equal(mayor(20_000, true)?.categories[0], "local_leader");
    assert.equal(mayor(20_000), null);
});

test("an embassy counts for the sending state, not the host", () => {
    const envoy = (sender: string) =>
        classifyOffice(
            "Q1",
            office({
                kinds: new Set(["diplomat"]),
                label: "Ambassador of the United Kingdom to Nepal",
                parentJurisdictions: new Set([sender]),
            }),
            nepal
        );
    assert.equal(envoy("Q145"), null);
    assert.equal(envoy("Q837")?.categories[0], "diplomat");
});

const holding = (overrides: Partial<Holding>): Holding => ({
    born: null,
    died: null,
    endDate: null,
    personId: "Q1",
    positionId: "Q2",
    startDate: null,
    ...overrides,
});
const legislator = classifyTitle("Member of the Parliament of Nepal");
const minister = classifyTitle("Minister of Finance");
const term = (overrides: Partial<Holding>, role = legislator) =>
    positionFromHolding(holding(overrides), role, "1945-01-01", "2026-10-05");

test("terms before the horizon are left out; open ones close at death", () => {
    assert.equal(term({ endDate: "1940-03-01", startDate: "1935-01-01" }), null);
    assert.equal(term({ endDate: "1950-03-01" })?.endDate, "1950-03-01");
    const closedByDeath = term({ died: "1999-07-01", startDate: "1990-01-01" });
    assert.equal(closedByDeath?.endDate, "1999-07-01");
    assert.equal(closedByDeath?.undated, undefined);
});

test("a long-open seat in a shared office is of unknown end, not current", () => {
    assert.equal(term({ startDate: "1980-01-01" })?.undated, true);
    assert.equal(term({ startDate: "2022-12-22" })?.undated, undefined);
    // A single-holder office keeps its open term: its successor closes it elsewhere.
    assert.equal(term({ startDate: "1980-01-01" }, minister)?.undated, undefined);
});

test("undated terms count only for people of the period, and are never current", () => {
    const undated = term({ born: "1950-02-02" });
    assert.equal(undated?.undated, true);
    assert.equal(undated?.endDate, null);
    assert.equal(term({ born: "1820-01-01", died: "1890-01-01" }), null);
    assert.equal(term({}), null);
});

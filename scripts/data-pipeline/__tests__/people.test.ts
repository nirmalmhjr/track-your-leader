import assert from "node:assert/strict";
import { test } from "node:test";

import {
    classifyOffice,
    type Holding,
    isEnvoyPostedTo,
    isMonarchOf,
    isOfficeOfCountry,
    type OfficeInfo,
    positionFromHolding,
    regionalOr,
} from "../extract/people.extract";
import { classifyTitle } from "../extract/roles";
import { parseQleverTsv } from "../sources/qlever";
import type { CountryContext } from "../types";

const nepal: CountryContext = {
    code: "NPL",
    formerHeadOfGovernmentOffices: [],
    formerHeadOfStateOffices: ["Q19700527"],
    headOfGovernmentOffice: "Q2099",
    headOfStateOffice: "Q2100",
    wikidataId: "Q837",
};

const office = (overrides: Partial<OfficeInfo>): OfficeInfo => ({
    countries: new Set(),
    isCapital: false,
    jurisdictions: new Set(),
    kinds: new Set(),
    label: "Some office",
    parentJurisdictions: new Set(),
    population: 0,
    servesInternationalBody: false,
    states: new Set(),
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
                label: "Ambassador extraordinary and plenipotentiary",
                parentJurisdictions: new Set([sender]),
            }),
            nepal
        );
    assert.equal(envoy("Q145"), null);
    assert.equal(envoy("Q837")?.categories[0], "diplomat");
});

test("an envoy whose title posts them to the country for another state is left out", () => {
    // Wikidata often records neither the sending state nor the envoy's citizenship.
    assert.equal(isEnvoyPostedTo("Ambassador of Israel to Nepal", "NPL"), true);
    assert.equal(isEnvoyPostedTo("Ambassador of the European Union to Nepal", "NPL"), true);
    assert.equal(isEnvoyPostedTo("High Commissioner of India in Nepal", "NPL"), true);
    assert.equal(isEnvoyPostedTo("Ambassador of Nepal to the United States", "NPL"), false);
    assert.equal(
        isEnvoyPostedTo("Permanent Representative of Nepal to the United Nations", "NPL"),
        false
    );
    assert.equal(isEnvoyPostedTo("Ambassador of Nepal to Israel", "ISR"), true);

    const role = (label: string) =>
        classifyOffice("Q1", office({ kinds: new Set(["diplomat"]), label }), nepal)?.categories[0];
    assert.equal(role("Ambassador of Israel to Nepal"), undefined);
    assert.equal(role("Ambassador of Nepal to India"), "diplomat");
});

test("an office reached through a body that merely lies in the country is left out", () => {
    // "Grand Mufti of India" (P17 India), whose jurisdiction, the Islamic Community of India,
    // Wikidata places in India, Nepal, Sri Lanka and the Maldives.
    const mufti = office({
        countries: new Set(["Q668"]),
        jurisdictions: new Set(["Q78496124"]),
        label: "Grand Mufti of India",
        states: new Set(["Q668"]),
    });
    assert.equal(isOfficeOfCountry(mufti, nepal), false);
    assert.equal(isOfficeOfCountry(mufti, { ...nepal, code: "IND", wikidataId: "Q668" }), true);

    // The Parliamentary Assembly of the Council of Europe, which Wikidata places in France.
    const assembly = office({ jurisdictions: new Set(["Q8908"]), servesInternationalBody: true });
    assert.equal(isOfficeOfCountry(assembly, { ...nepal, code: "FRA", wikidataId: "Q142" }), false);
    const delegate = office({
        ...assembly,
        countries: new Set(["Q142"]),
        states: new Set(["Q142"]),
    });
    assert.equal(isOfficeOfCountry(delegate, { ...nepal, code: "FRA", wikidataId: "Q142" }), true);
});

test("offices of a country's territories and former states stay with it", () => {
    const mayor = office({ jurisdictions: new Set(["Q3037"]), label: "Mayor of Kathmandu" });
    assert.equal(isOfficeOfCountry(mayor, nepal), true);
    // Gibraltar and the Soviet Union aren't sovereign states (now).
    const territorial = office({
        countries: new Set(["Q1410"]),
        jurisdictions: new Set(["Q1410"]),
    });
    assert.equal(
        isOfficeOfCountry(territorial, { ...nepal, code: "GBR", wikidataId: "Q145" }),
        true
    );
});

test("the leader offices of the state a country succeeded count as its leaders", () => {
    // "King of Nepal", the head of state of the Kingdom of Nepal.
    const role = classifyOffice("Q19700527", office({ label: "King of Nepal" }), nepal);
    assert.deepEqual(role?.categories, ["head_of_state"]);
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

test("monarchs of a kingdom the country was are its heads of state, consorts and heirs aren't", () => {
    const egypt = {
        ...nepal,
        code: "EGY" as const,
        formerHeadOfStateOffices: [],
        wikidataId: "Q79",
    };
    const role = (label: string) => classifyOffice("Q1", office({ label }), egypt)?.categories[0];
    assert.equal(role("King of Egypt"), "head_of_state");
    assert.equal(isMonarchOf("Sultan of the Maldives", "MDV"), true);
    assert.equal(isMonarchOf("King of the Hellenes", "GRC"), true);
    assert.equal(isMonarchOf("King of Egypt", "SDN"), false);
    // Consorts, heirs and militant leaders bear these titles too.
    assert.equal(isMonarchOf("Empress of Japan", "JPN"), false);
    assert.equal(isMonarchOf("Prince of Wales", "GBR"), false);
    assert.equal(isMonarchOf("Emir of the Islamic State of Iraq", "IRQ"), false);
});

test("a region's head of government is a regional leader, not the country's", () => {
    assert.equal(
        regionalOr("head_of_government", "Prime Minister of the Faroe Islands", "DNK"),
        "regional_leader"
    );
    assert.equal(
        regionalOr("head_of_government", "Prime Minister of Tatarstan", "RUS"),
        "regional_leader"
    );
    assert.equal(
        regionalOr("head_of_government", "Prime Minister of Nepal", "NPL"),
        "head_of_government"
    );
    assert.equal(
        regionalOr("head_of_government", "Prime Minister of the Kingdom of Nepal", "NPL"),
        "head_of_government"
    );
    assert.equal(regionalOr("minister", "Prime Minister of Tatarstan", "RUS"), "minister");
});

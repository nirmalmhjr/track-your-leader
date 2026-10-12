import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizeTerms } from "../extract/leaders.extract";
import { classifyTitle } from "../extract/roles";
import { formatCiaName, isSameName } from "../lib/text";

test("CIA names become title case, keeping prefixes and regnal numbers", () => {
    assert.equal(formatCiaName("Balendra SHAH"), "Balendra Shah");
    assert.equal(formatCiaName("Pat McFADDEN"), "Pat McFadden");
    assert.equal(formatCiaName("XI Jinping"), "Xi Jinping");
    assert.equal(formatCiaName("CHARLES III"), "Charles III");
    assert.equal(formatCiaName("Reem ALABALI-RADOVAN"), "Reem Alabali-Radovan");
});

test("names match across word order, accents and a missing middle name", () => {
    assert.ok(isSameName("ISHIBA Shigeru", "Shigeru Ishiba"));
    assert.ok(isSameName("Sébastien Lecornu", "Sebastien LECORNU"));
    assert.ok(isSameName("Ram Sahaya Prasad Yadav", "Ram Sahaya Yadav"));
    assert.ok(!isSameName("Joe Biden", "Hunter Biden"));
    assert.ok(!isSameName("Shah", "Balendra Shah"));
});

test("titles map to generic roles and portfolios", () => {
    assert.deepEqual(classifyTitle("Prime Min.").categories, ["head_of_government"]);
    assert.deepEqual(classifyTitle("Chancellor").categories, ["head_of_government"]);
    assert.deepEqual(classifyTitle("Vice Pres.").categories, ["deputy_leader"]);

    const foreign = classifyTitle("Min. of Foreign Affairs");
    assert.equal(foreign.title, "Minister of Foreign Affairs");
    assert.equal(foreign.portfolio, "foreign_affairs");
    assert.equal(foreign.ministry, "Ministry of Foreign Affairs");

    assert.equal(classifyTitle("Chancellor of the Exchequer").portfolio, "finance");
    assert.equal(classifyTitle("United States Secretary of State").portfolio, "foreign_affairs");
    assert.equal(
        classifyTitle("Sec. of State for Foreign, Commonwealth, & Development Affairs").portfolio,
        "foreign_affairs"
    );
    assert.deepEqual(
        classifyTitle("Min. of State (Independent Charge) for Law & Justice").categories,
        ["junior_minister"]
    );
});

test("every politically exposed office gets a role", () => {
    const role = (title: string) => classifyTitle(title).categories[0];
    assert.equal(role("Ambassador to the US"), "diplomat");
    assert.equal(role("Permanent Representative to the UN, New York"), "diplomat");
    assert.equal(role("Governor, Central Bank"), "central_banker");
    assert.equal(role("Chief Justice"), "judiciary");
    assert.equal(role("Justice of the Supreme Court of India"), "judiciary");
    assert.equal(role("Chief of the Army Staff"), "military_leader");
    assert.equal(role("Member of the House of Representatives of Nepal"), "legislator");
    assert.equal(role("Deputy of the State Duma"), "legislator");
    assert.equal(role("Speaker of the National Assembly"), "legislator");
    assert.equal(role("Governor of Bagmati Province"), "regional_leader");
    assert.equal(role("Chief Minister of Kerala"), "regional_leader");
    assert.equal(role("Mayor of Kathmandu"), "local_leader");
    assert.equal(role("General Secretary of the Chinese Communist Party"), "party_leader");
    // Ministerial and leader titles keep winning over the wider patterns.
    assert.equal(role("Min. of Justice"), "minister");
    assert.equal(role("Deputy Prime Minister"), "deputy_leader");
    assert.equal(role("Deputy Min. of Health"), "junior_minister");
    assert.equal(role("Premier"), "head_of_government");
    assert.equal(role("Prime Minister of Iran"), "head_of_government");
    assert.equal(role("Premier of Ontario"), "regional_leader");
    assert.ok(classifyTitle("Ambassador to the US").isTracked);
});

test("every ministry maps to a portfolio", () => {
    const portfolio = (title: string) => classifyTitle(title).portfolio;
    assert.equal(portfolio("Minister of Health and Population"), "health");
    assert.equal(portfolio("Minister of Education, Science and Technology"), "education");
    assert.equal(portfolio("Minister of Labour, Employment and Social Security"), "labour");
    assert.equal(portfolio("Minister of Law, Justice and Parliamentary Affairs"), "justice");
    assert.equal(portfolio("Minister of Agriculture and Livestock Development"), "agriculture");
    assert.equal(portfolio("Minister of Physical Infrastructure and Transport"), "transport");
    assert.equal(portfolio("Minister for Women, Children and Senior Citizens"), "women");
    assert.equal(portfolio("Minister of Youth and Sports"), "youth");
    assert.equal(portfolio("Minister of Culture, Tourism and Civil Aviation"), "culture");
    assert.equal(portfolio("Minister of Industry, Commerce and Supplies"), "trade");
    assert.equal(portfolio("Ambassador to the US"), null);
});

test("office terms merge and predecessors are closed by successors", () => {
    const terms = normalizeTerms([
        { endDate: "2014-12-24", officeId: "Q1", personId: "A", startDate: "2012-12-26" },
        { endDate: null, officeId: "Q1", personId: "A", startDate: "2014-12-24" },
        { endDate: null, officeId: "Q1", personId: "B", startDate: "2020-09-16" },
    ]);
    assert.deepEqual(terms, [
        { endDate: "2020-09-16", officeId: "Q1", personId: "A", startDate: "2012-12-26" },
        { endDate: null, officeId: "Q1", personId: "B", startDate: "2020-09-16" },
    ]);
});

test("a governor-general represents the monarch, not a region", () => {
    assert.deepEqual(classifyTitle("Governor General of Canada").categories, ["governor_general"]);
    assert.deepEqual(classifyTitle("Governor-General of Jamaica").categories, ["governor_general"]);
    assert.deepEqual(classifyTitle("Gov. Gen.").categories, ["governor_general"]);
    assert.deepEqual(classifyTitle("Governor of Texas").categories, ["regional_leader"]);
});

test("Andorra's co-princes are heads of state", () => {
    assert.deepEqual(classifyTitle("French co-prince of Andorra").categories, ["head_of_state"]);
    assert.deepEqual(classifyTitle("Episcopal Co-Prince").categories, ["head_of_state"]);
});

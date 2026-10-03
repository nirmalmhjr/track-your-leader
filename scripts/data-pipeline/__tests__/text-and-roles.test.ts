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

test("ambassadors and central bankers are not tracked", () => {
    assert.equal(classifyTitle("Ambassador to the US").isTracked, false);
    assert.equal(classifyTitle("Governor, Central Bank").isTracked, false);
    assert.equal(classifyTitle("Min. of Finance").isTracked, true);
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

import assert from "node:assert/strict";
import { test } from "node:test";

import { directionOf, parseRelationsPage } from "../extract/claims/relations.claims";

const ARG_NZL = [
    { code: "ARG", name: "Argentina" },
    { code: "NZL", name: "New Zealand" },
] as const;

test("visit headings say which way the visits go", () => {
    assert.deepEqual(
        directionOf("High-level visits from Argentina to New Zealand[edit]", ARG_NZL),
        {
            from: "ARG",
            to: "NZL",
        }
    );
    const tza = [
        { code: "IND", name: "India" },
        { code: "TZA", name: "Tanzania" },
    ];
    assert.deepEqual(directionOf("Tanzania High Level Visits to India", tza), {
        from: "TZA",
        to: "IND",
    });
    assert.deepEqual(directionOf("Indian visits to Tanzania", tza), { from: "IND", to: "TZA" });
    // No direction, or a country outside the pair.
    assert.equal(directionOf("High-level visits", ARG_NZL), null);
    assert.equal(directionOf("Visits from Chile to Argentina", ARG_NZL), null);
});

test("listed visits under a directed heading are read, prose and undirected lists are not", () => {
    const html = `<div class="mw-parser-output">
      <div class="mw-heading mw-heading2"><h2>High-level visits</h2></div>
      <ul><li>Something undirected (1999)</li></ul>
      <div class="mw-heading mw-heading3"><h3>High-level visits from Argentina to New Zealand</h3></div>
      <ul>
        <li>President <a href="/wiki/Carlos_Menem">Carlos Menem</a> (1998)<sup>[5]</sup></li>
        <li>Secretary of Agriculture Ricardo Negri (2017)</li>
      </ul>
      <p>High-level visits from New Zealand to Argentina[1]</p>
      <ul><li>Deputy Prime Minister <a href="/wiki/David_Seymour">David Seymour</a> (January 2026)</li></ul>
      <p>In 2001 Prime Minister Helen Clark visited Buenos Aires and met President Fernando de la Rúa, a long paragraph of prose that is not read.</p>
    </div>`;
    const visits = parseRelationsPage(html, ARG_NZL);
    assert.deepEqual(
        visits.map((visit) => [visit.from, visit.to, visit.dates.startDate, visit.links[0]?.text]),
        [
            ["ARG", "NZL", "1998-01-01", "Carlos Menem"],
            ["ARG", "NZL", "2017-01-01", undefined],
            ["NZL", "ARG", "2026-01-01", "David Seymour"],
        ]
    );
    assert.equal(visits[2]?.dates.precision, "month");
});

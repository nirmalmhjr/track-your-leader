import assert from "node:assert/strict";
import { test } from "node:test";

import { parseTripTables } from "../extract/trip-tables.parse";
import { classifyTripType, detectEventName } from "../extract/trip-type.classify";

/** Trimmed copy of a real trip-list page: year headings, a row span and a nested details table. */
const PAGE = `
<div class="mw-heading mw-heading2"><h2 id="2014">2014</h2></div>
<table class="wikitable">
  <tbody>
    <tr><th></th><th>Country</th><th>Areas visited</th><th>Date(s)</th><th>Purpose</th><th>Notes</th></tr>
    <tr>
      <th>1</th>
      <td><span class="flagicon"></span><a href="/wiki/Bhutan" title="Bhutan">Bhutan</a></td>
      <td><a href="/wiki/Paro,_Bhutan" title="Paro, Bhutan">Paro</a>, <a href="/wiki/Thimphu" title="Thimphu">Thimphu</a></td>
      <td>15–16 June<sup class="reference">[1]</sup></td>
      <td><a href="/wiki/State_visit" title="State visit">State visit</a></td>
      <td rowspan="2"><div class="hatnote">See also: Bhutan–India relations</div>
        <table class="wikitable"><tr><th>Details</th></tr><tr><td>First foreign visit as Prime Minister.</td></tr></table>
      </td>
    </tr>
    <tr>
      <th>2</th>
      <td><a href="/wiki/Brazil" title="Brazil">Brazil</a></td>
      <td><a href="/wiki/Fortaleza" title="Fortaleza">Fortaleza</a></td>
      <td>13–17 July</td>
      <td><a href="/wiki/6th_BRICS_summit" title="6th BRICS summit">6th BRICS summit</a></td>
    </tr>
  </tbody>
</table>
<div class="mw-heading mw-heading2"><h2 id="Future_trips">Future trips</h2></div>
<table class="wikitable">
  <tr><th>Country</th><th>Dates</th><th>Purpose</th></tr>
  <tr><td><a href="/wiki/Japan" title="Japan">Japan</a></td><td>June 2027</td><td>Official visit</td></tr>
</table>
<table class="wikitable">
  <tr><th>Number of visits</th><th>Country</th></tr>
  <tr><td>1 visit</td><td>Austria</td></tr>
</table>`;

test("rows are read by header, with years, spans and links", () => {
    const { rows, skippedTables } = parseTripTables(PAGE);
    assert.equal(rows.length, 3);

    const [bhutan, brazil, japan] = rows;
    assert.equal(bhutan.date, "15–16 June");
    assert.equal(bhutan.contextYear, 2014);
    assert.deepEqual(
        bhutan.cities?.links.map((link) => link.title),
        ["Paro, Bhutan", "Thimphu"]
    );
    assert.equal(bhutan.country?.links[0]?.title, "Bhutan");
    assert.equal(bhutan.notes, "First foreign visit as Prime Minister.");
    // The notes cell spans two rows, so Brazil inherits it.
    assert.equal(brazil.notes, bhutan.notes);
    assert.equal(brazil.purpose?.links[0]?.text, "6th BRICS summit");

    assert.equal(japan.sectionHint, "planned");
    assert.equal(japan.contextYear, null);

    assert.deepEqual(skippedTables, ["number of visits | country"]);
});

test("trip types and event names come from the purpose", () => {
    assert.equal(classifyTripType("State visit"), "state_visit");
    assert.equal(classifyTripType("6th BRICS summit"), "summit");
    assert.equal(classifyTripType("Working visit"), "official_visit");
    assert.equal(classifyTripType("", "Addressed the UN General Assembly"), "conference");
    assert.equal(classifyTripType("Private visit"), "other");

    assert.equal(detectEventName(["6th BRICS summit"], "6th BRICS summit"), "6th BRICS summit");
    assert.equal(detectEventName([], "State visit; meeting with the King"), null);
});

test("rows under a received heading are marked as hosted visits", () => {
    const page = `
<div class="mw-heading mw-heading2"><h2>State visits made by Harald V</h2></div>
<table class="wikitable">
  <tr><th>Date(s)</th><th>Country</th><th>Details</th></tr>
  <tr><td>28–30 October 1991</td><td><a href="/wiki/Denmark" title="Denmark">Denmark</a></td><td>Visiting Queen Margrethe II</td></tr>
</table>
<div class="mw-heading mw-heading2"><h2>State visits received by Harald V</h2></div>
<table class="wikitable">
  <tr><th>Date(s)</th><th>Country</th><th>Details</th></tr>
  <tr><td>5–7 May 1992</td><td><a href="/wiki/Iceland" title="Iceland">Iceland</a></td><td>President Vigdís Finnbogadóttir</td></tr>
</table>`;
    const { rows } = parseTripTables(page);
    assert.deepEqual(
        rows.map((row) => [row.country?.text, row.received]),
        [
            ["Denmark", false],
            ["Iceland", true],
        ]
    );
});

test("Spanish and French tables are read by their headers", () => {
    const page = `
<h2>Visitas recibidas</h2>
<table class="wikitable">
  <tr><th>Fecha</th><th>País</th><th>Ciudades</th><th>Motivo</th><th>Detalles</th></tr>
  <tr><td>15 de junio</td><td><a href="/wiki/Chile" title="Chile">Chile</a></td><td>Santiago</td><td>Visita de Estado</td><td>Reunión</td></tr>
</table>
<h2>Visites à venir</h2>
<table class="wikitable">
  <tr><th>Date</th><th>Pays</th><th>Villes</th><th>Événement</th><th>Détails</th></tr>
  <tr><td>juin 2027</td><td><a href="/wiki/Japon" title="Japon">Japon</a></td><td>Tokyo</td><td>Sommet</td><td>Rencontre</td></tr>
</table>`;
    const [spanish, french] = parseTripTables(page).rows;
    assert.equal(spanish?.country?.text, "Chile");
    assert.equal(spanish?.cities?.text, "Santiago");
    assert.equal(spanish?.purpose?.text, "Visita de Estado");
    assert.equal(spanish?.notes, "Reunión");
    assert.equal(spanish?.received, true);
    assert.equal(french?.purpose?.text, "Sommet");
    assert.equal(french?.notes, "Rencontre");
    assert.equal(french?.sectionHint, "planned");
});

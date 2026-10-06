import assert from "node:assert/strict";
import { test } from "node:test";

import { parseSummitPage, resolveAttendee } from "../extract/claims/summits.claims";

const FLAG = (country: string) =>
    `<span class="flagicon"><img src="//upload.wikimedia.org/x/Flag_of_${country}.svg/23px-Flag_of_${country}.svg.png"></span>`;

/** Trimmed from "1st Summit of the Non-Aligned Movement" and "2014 G20 Brisbane summit". */
const PAGE = `
<table class="infobox">
  <tr><th>Host country</th><td><a href="/wiki/Yugoslavia">Yugoslavia</a></td></tr>
  <tr><th>Date</th><td>1–6 September 1961</td></tr>
  <tr><th>Cities</th><td><a href="/wiki/Belgrade">Belgrade</a></td></tr>
  <tr><td>${FLAG("Yugoslavia")} <a href="/wiki/Yugoslavia">Yugoslavia</a></td></tr>
</table>
<h2>Participants</h2>
<ul>
  <li>${FLAG("Afghanistan")} <a href="/wiki/Afghanistan">Afghanistan</a>: <a href="/wiki/Mohammed_Daoud_Khan">Mohammed Daoud Khan</a>, <a href="/wiki/Prime_Minister_of_Afghanistan">Prime Minister of Afghanistan</a></li>
  <li>${FLAG("Algeria")} <a href="/wiki/Algeria">Algeria</a></li>
  <li>${FLAG("the_People's_Republic_of_China")} <a href="/wiki/Xi_Jinping">Xi Jinping</a>, <a href="/wiki/President_of_China">President</a></li>
</ul>
<div class="navbox"><ul><li>${FLAG("Egypt")} <a href="/wiki/Egypt">Egypt</a> <a href="/wiki/Gamal_Abdel_Nasser">Nasser</a></li></ul></div>`;

const COUNTRIES: Readonly<Record<string, string>> = { Afghanistan: "AFG", Algeria: "DZA" };
const PEOPLE = new Set(["Mohammed Daoud Khan", "Xi Jinping", "Gamal Abdel Nasser"]);
const lookups = {
    countryOf: (link: { title: string }) => COUNTRIES[link.title] ?? null,
    isPerson: (link: { title: string }) => PEOPLE.has(link.title),
};

test("summit pages give dates, host, city and the flagged rows outside the boxes", () => {
    const page = parseSummitPage(PAGE, "1st Summit of the Non-Aligned Movement");
    assert.deepEqual(page.dates, {
        endDate: "1961-09-06",
        precision: "day",
        startDate: "1961-09-01",
    });
    assert.equal(page.host, "Yugoslavia");
    assert.equal(page.city, "Belgrade");
    // The infobox and navbox rows are left out.
    assert.equal(page.rows.length, 3);
});

test("attendees need a person and a country, from a link or the flag", () => {
    const [afghanistan, algeria, china] = parseSummitPage(PAGE, "x 1961").rows.map((row) =>
        resolveAttendee(row, lookups)
    );
    assert.equal(afghanistan?.countryCode, "AFG");
    assert.equal(afghanistan?.person.text, "Mohammed Daoud Khan");
    assert.equal(afghanistan?.role, "Prime Minister of Afghanistan");
    // A country without a person doesn't say who went.
    assert.equal(algeria, null);
    // No country link: the flag names it, and the office link isn't taken for the person.
    assert.equal(china?.countryCode, "CHN");
    assert.equal(china?.person.text, "Xi Jinping");
});

test("dates given only in the infobox's navigation row are found", () => {
    const page = parseSummitPage(
        `<table class="infobox">
          <tr><td>← 9th 25–27 July 2018 11th →</td></tr>
          <tr><th>Host country</th><td>South Africa</td></tr>
          <tr><th>Cities</th><td><a href="/wiki/Johannesburg">Johannesburg</a></td></tr>
        </table>`,
        "10th BRICS summit"
    );
    assert.equal(page.dates?.startDate, "2018-07-25");
    assert.equal(page.dates?.endDate, "2018-07-27");
    assert.equal(page.host, "South Africa");
});

test("summits held by video are recognised", () => {
    const html = (lead: string) =>
        `<table class="infobox"><tr><th>Date</th><td>21–22 November 2020</td></tr></table><p>${lead}</p>`;
    assert.equal(
        parseSummitPage(html("The summit was held virtually because of COVID-19."), "x").isVirtual,
        true
    );
    assert.equal(parseSummitPage(html("Leaders met in Riyadh."), "x").isVirtual, false);
    // A neighbouring summit held by video doesn't make this one virtual.
    const neighbour = `<table class="infobox"><tr><th>Date</th><td>14 June 2021</td></tr>
      <tr><th>Precedes</th><td>2022 NATO virtual summit</td></tr></table><p>Leaders met in Brussels.</p>`;
    assert.equal(parseSummitPage(neighbour, "2021 Brussels NATO summit").isVirtual, false);
});

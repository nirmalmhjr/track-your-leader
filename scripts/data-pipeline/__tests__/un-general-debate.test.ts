import assert from "node:assert/strict";
import { test } from "node:test";

import { parseGeneralDebate, parseOrdinal } from "../extract/claims/un-general-debate.claims";

const flag = '<span class="flagicon"><img alt="" src="flag.png"></span> ';

const page = `
<table class="infobox"><tr><td>22 – 28 September 2015</td></tr></table>
<h2>Notable speeches</h2>
<ul><li>${flag}<a href="/wiki/Iran">Iran</a> – President <a href="/wiki/Hassan_Rouhani">Hassan Rouhani</a></li></ul>
<h2>Speaking schedule</h2>
<h3>28 September</h3>
<ul>
<li>${flag}<a href="/wiki/Nepal">Nepal</a> – Prime Minister <a href="/wiki/Sushil_Koirala">Sushil Koirala</a></li>
<li>${flag}France – President <a href="/wiki/Fran%C3%A7ois_Hollande">François Hollande</a> (Scheduled)</li>
<li>${flag}Austria (Scheduled)</li>
</ul>
<h3>29 September</h3>
<ul><li>${flag}<a href="/wiki/Georgia_(country)">Georgia</a> – President Giorgi Margvelashvili</li></ul>`;

test("session numbers are read from their ordinal words", () => {
    assert.equal(parseOrdinal("sixty-third"), 63);
    assert.equal(parseOrdinal("seventieth"), 70);
    assert.equal(parseOrdinal("eighty-first"), 81);
    assert.equal(parseOrdinal("session"), null);
});

test("speakers are read under the day they spoke, from the schedule only", () => {
    const { skipped, speeches } = parseGeneralDebate(page, 2015);
    assert.deepEqual(
        speeches.map(({ countryName, date, personName, personTitle, title }) => ({
            countryName,
            personName,
            personTitle,
            start: date.startDate,
            title,
        })),
        [
            {
                countryName: "Nepal",
                personName: "Sushil Koirala",
                personTitle: "Sushil Koirala",
                start: "2015-09-28",
                title: "Prime Minister",
            },
            {
                countryName: "France",
                personName: "François Hollande",
                personTitle: "François Hollande",
                start: "2015-09-28",
                title: "President",
            },
            {
                countryName: "Georgia (country)",
                personName: "Giorgi Margvelashvili",
                personTitle: null,
                start: "2015-09-29",
                title: "President",
            },
        ]
    );
    assert.deepEqual(
        skipped.map((row) => row.text),
        ["Austria (Scheduled)"]
    );
});

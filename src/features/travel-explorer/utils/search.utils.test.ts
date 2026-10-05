import assert from "node:assert/strict";
import { test } from "node:test";

import { createSearchEntry, searchEntries } from "@/features/travel-explorer/utils/search.utils";
import { ALL_COUNTRY_REFERENCES } from "@/lib/geo/country-reference";
import { getCountrySearchTerms } from "@/lib/geo/country-search-terms";

const entries = [
    createSearchEntry("nepal", "Nepal", ["NPL"], { isCurrent: true }),
    createSearchEntry("former-pm", "Pushpa Kamal Dahal", ["Prime Minister", "Nepal"], {
        trips: 19,
    }),
    createSearchEntry("current-pm", "Balendra Shah", ["Prime Minister", "Nepal"], {
        isCurrent: true,
        trips: 2,
    }),
    createSearchEntry("nepomniachtchi", "Ian Nepomniachtchi", ["Chess", "Russia"], { trips: 40 }),
    createSearchEntry("mendes", "Gonçalo Mendes", ["Minister", "Portugal"]),
];

test("name matches come before word and partial matches", () => {
    assert.deepEqual(searchEntries(entries, "nep", 10), [
        "nepal",
        "current-pm",
        "nepomniachtchi",
        "former-pm",
    ]);
});

test("a whole-word match beats a name that merely starts with the query", () => {
    const people = [
        createSearchEntry("keita", "Modibo Keïta", ["Former President", "Mali"]),
        createSearchEntry("modi", "Narendra Modi", ["Prime Minister", "India"], {
            isCurrent: true,
        }),
    ];
    assert.deepEqual(searchEntries(people, "modi", 10), ["modi", "keita"]);
});

test("current office holders rank before former ones, then by trips", () => {
    assert.deepEqual(searchEntries(entries, "prime minister", 10), ["current-pm", "former-pm"]);
});

test("accents are ignored and results are capped", () => {
    assert.deepEqual(searchEntries(entries, "goncalo", 10), ["mendes"]);
    assert.equal(searchEntries(entries, "e", 2).length, 2);
    assert.deepEqual(searchEntries(entries, "   ", 10), []);
});

const countryEntries = ALL_COUNTRY_REFERENCES.map((reference) =>
    createSearchEntry(reference.alpha3, reference.name, getCountrySearchTerms(reference.alpha3))
);

test("every country comes first when searched by its ISO alpha-3 or alpha-2 code", () => {
    for (const { alpha2, alpha3 } of ALL_COUNTRY_REFERENCES) {
        assert.equal(searchEntries(countryEntries, alpha3, 1)[0], alpha3, alpha3);
        assert.equal(searchEntries(countryEntries, alpha2, 1)[0], alpha3, alpha2);
    }
});

test("everyday abbreviations find the country they stand for", () => {
    assert.deepEqual(searchEntries(countryEntries, "uk", 2), ["GBR", "UKR"]);
    assert.equal(searchEntries(countryEntries, "usa", 1)[0], "USA");
    assert.equal(searchEntries(countryEntries, "uae", 1)[0], "ARE");
    assert.equal(searchEntries(countryEntries, "burma", 1)[0], "MMR");
});

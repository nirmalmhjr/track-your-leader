import assert from "node:assert/strict";
import { test } from "node:test";

import {
    familyNameOf,
    governmentRole,
    parseDelegations,
} from "../extract/claims/un-delegations.parse";

const list = `
NEPAL - NEPAL
Chief delegate - Chef de délégation
Mr G. Pokharel
Minister of Health and Population
Delegate(s) - Délégué(s)
Dr N.M. Shrestha
Chief Specialist, Ministry of Health and Population
Mr B.J. Paudyal
Minister Counsellor, Permanent Mission, Geneva
- 31 -
NICARAGUA - NICARAGUA
Chef de délégation - Chief delegate
Sra. C. Sánchez Reyes
Viceministra de Salud
BOLIVIA (PLURINATIONAL STATE OF) - BOLIVIE (ÉTAT PLURINATIONAL DE)
Chief Delegate-Chef de délégation
M. J. Pérez
Ministre de la Santé et des Sports
OBSERVERS
HOLY SEE - SAINT-SIÈGE
Mgr S. Tomasi
Minister of Health`;

test("members of government are read from a delegation list, and nobody else", () => {
    assert.deepEqual(parseDelegations(list.split("\n")), [
        {
            categories: ["minister"],
            countryCode: "NPL",
            familyName: "Pokharel",
            portfolio: "health",
            title: "Minister of Health and Population",
        },
        {
            categories: ["junior_minister"],
            countryCode: "NIC",
            familyName: "Sánchez Reyes",
            portfolio: "health",
            title: "Viceministra de Salud",
        },
        {
            categories: ["minister"],
            countryCode: "BOL",
            familyName: "Pérez",
            portfolio: "health",
            title: "Ministre de la Santé et des Sports",
        },
    ]);
});

test("delegates' family names drop honorifics and initials", () => {
    assert.equal(familyNameOf("Mr S.S. Bhandari"), "Bhandari");
    assert.equal(familyNameOf("Sra. C. Sánchez Reyes"), "Sánchez Reyes");
    assert.equal(familyNameOf("Dr K.R. Hadj Mati"), "Hadj Mati");
});

test("diplomats, civil servants and academics aren't members of government", () => {
    assert.equal(governmentRole("Minister Counsellor, Permanent Mission, Geneva"), null);
    assert.equal(governmentRole("Secretary, Ministry of Health"), null);
    assert.equal(governmentRole("Vice Chancellor, Medical University"), null);
    assert.deepEqual(governmentRole("Cabinet Secretary for Health"), {
        categories: ["minister"],
        portfolio: "health",
    });
});

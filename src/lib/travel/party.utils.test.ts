import assert from "node:assert/strict";
import { test } from "node:test";

import { abbreviateParty, countParties } from "@/lib/travel/party.utils";
import type { Official } from "@/types/travel.types";

const member = (id: string, party: string | null): Official => ({
    countryCode: "NPL",
    fullName: id,
    id,
    party,
    photoUrl: null,
    positions: [],
    sources: [],
    summary: "",
    wikidataId: null,
});

test("long party names shorten to their initials, keeping the faction", () => {
    assert.equal(abbreviateParty("Rastriya Swatantra Party"), "RSP");
    assert.equal(
        abbreviateParty("Communist Party of Nepal (Unified Marxist–Leninist)"),
        "CPN (UML)"
    );
    assert.equal(abbreviateParty("Communist Party of Nepal (Maoist Centre)"), "CPN (MC)");
});

test("short party names and names without enough capitals stay whole", () => {
    assert.equal(abbreviateParty("Nepali Congress"), "Nepali Congress");
    assert.equal(abbreviateParty("Independent politicians"), "Independent politicians");
});

test("countParties puts the largest parties first and unrecorded parties last", () => {
    const counts = countParties([
        member("a", null),
        member("b", "Nepali Congress"),
        member("c", "Rastriya Swatantra Party"),
        member("d", "Rastriya Swatantra Party"),
        member("e", "Janata Samajbadi Party"),
    ]);
    assert.deepEqual(counts, [
        { count: 2, party: "Rastriya Swatantra Party" },
        { count: 1, party: "Janata Samajbadi Party" },
        { count: 1, party: "Nepali Congress" },
        { count: 1, party: null },
    ]);
});

import assert from "node:assert/strict";
import { test } from "node:test";

import type { RoleCategory } from "@/types/travel.types";

import { leaderYears } from "../extract/coverage";
import type { WarehouseOfficial } from "../lib/warehouse";

const official = (
    id: string,
    positions: { endDate: string | null; role?: RoleCategory; startDate: string; title: string }[]
): WarehouseOfficial => ({
    aliases: [],
    countryCode: "BTN",
    fullName: id,
    id,
    party: null,
    photoUrl: null,
    positions: positions.map((position, index) => ({
        categories: [position.role ?? "head_of_state"],
        endDate: position.endDate,
        id: `${id}-p${index + 1}`,
        ministry: null,
        portfolio: null,
        startDate: position.startDate,
        title: position.title,
    })),
    sources: [],
    summary: "",
    wikidataId: null,
});

const trip = (officialId: string, startDate: string) => ({ officialId, startDate });

test("each year a leader held office for at least half of is counted with its trips", () => {
    const king = official("king", [
        { endDate: null, startDate: "2023-03-01", title: "King of Bhutan" },
    ]);
    const years = leaderYears(
        new Map([["BTN", { officials: [king], trips: [trip("king", "2024-05-02")] }]]),
        "2025-10-07"
    );
    assert.deepEqual(
        years.map(({ trips, year }) => [year, trips]),
        [
            [2025, 0],
            [2024, 1],
            [2023, 0],
        ]
    );
});

test("an open term ends when the next holder of the office took over", () => {
    // Wikidata leaves the old king's term open; his successor's start closes it.
    const oldKing = official("old", [{ endDate: null, startDate: "1990-01-01", title: "King" }]);
    const newKing = official("new", [{ endDate: null, startDate: "2020-01-01", title: "King" }]);
    const years = leaderYears(
        new Map([["BTN", { officials: [oldKing, newKing], trips: [] }]]),
        "2022-10-07"
    );
    assert.equal(Math.max(...years.filter((y) => y.officialId === "old").map((y) => y.year)), 2019);
    assert.equal(years.filter((y) => y.officialId === "new").length, 3);
});

test("a short spell in office, this year's first weeks and ministers aren't counted", () => {
    const caretaker = official("caretaker", [
        { endDate: "2021-03-01", startDate: "2021-01-10", title: "Prime Minister" },
        { endDate: null, role: "minister", startDate: "2010-01-01", title: "Minister of Health" },
    ]);
    const king = official("king", [{ endDate: null, startDate: "2010-01-01", title: "King" }]);
    const files = new Map([["BTN", { officials: [caretaker, king], trips: [] }]]);
    assert.deepEqual(
        leaderYears(files, "2022-10-07").filter((y) => y.officialId === "caretaker"),
        []
    );
    assert.equal(
        leaderYears(files, "2023-02-01").some((y) => y.year === 2023),
        false
    );
});

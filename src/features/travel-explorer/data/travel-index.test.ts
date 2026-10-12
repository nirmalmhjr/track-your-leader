import assert from "node:assert/strict";
import { test } from "node:test";

import { decodeOfficial, encodeOfficial, officialRow } from "./travel-index";

const charles = {
    countryCode: "GBR",
    fullName: "Charles III",
    id: "charles-iii",
    party: null,
    photoUrl: null,
    positions: [
        {
            categories: ["head_of_state" as const],
            endDate: null,
            id: "charles-iii-p1",
            ministry: null,
            portfolio: null,
            startDate: "2022-09-08",
            title: "Monarch of the United Kingdom",
        },
        {
            categories: ["head_of_state" as const],
            countryCode: "CAN",
            endDate: null,
            id: "charles-iii-p2",
            ministry: null,
            portfolio: null,
            startDate: "2022-09-08",
            title: "Monarch of Canada",
        },
        {
            categories: ["governor_general" as const],
            countryCode: "AUS",
            endDate: null,
            id: "charles-iii-p3",
            ministry: null,
            portfolio: null,
            startDate: null,
            title: "Undated office abroad",
            undated: true as const,
        },
    ],
    wikidataId: "Q43274",
};

test("an office of another country keeps its country through the index", () => {
    const row = encodeOfficial(charles);
    assert.equal(officialRow.safeParse(row).success, true);
    const [home, canada, undated] = decodeOfficial(row).positions;
    assert.equal(home?.countryCode, undefined);
    assert.equal(canada?.countryCode, "CAN");
    assert.equal(canada?.endDate, null);
    assert.equal(canada?.undated, undefined);
    assert.equal(undated?.countryCode, "AUS");
    assert.equal(undated?.undated, true);
    assert.deepEqual(undated?.categories, ["governor_general"]);
});

import assert from "node:assert/strict";
import { test } from "node:test";

import type {
    ExplorerFilters,
    ExplorerSelection,
} from "@/features/travel-explorer/types/explorer.types";
import {
    createTravelMatcher,
    EMPTY_FILTERS,
    getDateRangeExemption,
    pickOfficeTenure,
    withoutDateRange,
} from "@/features/travel-explorer/utils/filters.utils";
import type { Official, Position, TravelRecord } from "@/types/travel.types";

const position = (endDate: string | null): Position =>
    ({ categories: ["minister"], endDate, id: `p-${endDate}` }) as unknown as Position;

const official = (id: string, endDate: string | null): Official =>
    ({ countryCode: "NPL", id, positions: [position(endDate)] }) as unknown as Official;

const trip = (officialId: string, startDate: string): TravelRecord =>
    ({
        destination: { city: "Delhi", countryCode: "IND", region: "asia" },
        endDate: startDate,
        id: `${officialId}-${startDate}`,
        officialId,
        originCountryCode: "NPL",
        startDate,
        status: "completed",
        type: "official_visit",
    }) as unknown as TravelRecord;

const formerPm = official("former-pm", "2018-02-15");
const currentPm = official("current-pm", null);
const officialById = new Map([formerPm, currentPm].map((entry) => [entry.id, entry]));
const roster = [formerPm, currentPm];

const recentWindow: ExplorerFilters = { ...EMPTY_FILTERS, from: "2026-09-05", to: "2026-10-05" };
const oldTrip = trip("former-pm", "2016-02-19");
const recentTrip = trip("current-pm", "2026-09-20");

const countrySelection: ExplorerSelection = {
    country: "NPL",
    official: null,
    trip: null,
    view: "officials",
};

test("lifting the date range keeps every other filter", () => {
    const filters: ExplorerFilters = { ...recentWindow, types: ["state_visit"] };
    assert.deepEqual(withoutDateRange(filters), { ...filters, from: null, to: null });
});

test("an empty side of the switch gives way to the other one", () => {
    assert.equal(pickOfficeTenure("former", { current: 3, former: 2 }), "former");
    assert.equal(pickOfficeTenure("former", { current: 3, former: 0 }), "current");
    assert.equal(pickOfficeTenure("current", { current: 0, former: 2 }), "former");
});

test("a former official's profile shows every year of their travel", () => {
    const exemption = getDateRangeExemption({
        chosenTenure: "current",
        officialById,
        roster,
        selection: { ...countrySelection, official: "former-pm" },
    });
    assert.deepEqual(exemption, { kind: "official", officialId: "former-pm" });
    const matches = createTravelMatcher(recentWindow, exemption);
    assert.equal(matches(oldTrip), true);
    assert.equal(matches(recentTrip), true);
});

test("a current official's profile keeps the date range", () => {
    const exemption = getDateRangeExemption({
        chosenTenure: "former",
        officialById,
        roster,
        selection: { ...countrySelection, official: "current-pm" },
    });
    assert.deepEqual(exemption, { kind: "none" });
    assert.equal(createTravelMatcher(recentWindow, exemption)(oldTrip), false);
});

test("the former side shows former officials' trips from every year, and only theirs", () => {
    const exemption = getDateRangeExemption({
        chosenTenure: "former",
        officialById,
        roster,
        selection: countrySelection,
    });
    assert.equal(exemption.kind, "former");
    const matches = createTravelMatcher(recentWindow, exemption);
    assert.equal(matches(oldTrip), true);
    assert.equal(matches(recentTrip), false);
});

test("the in-office side and the other tabs keep the date range", () => {
    for (const selection of [countrySelection, { ...countrySelection, view: "travel" as const }]) {
        const chosenTenure = selection.view === "travel" ? "former" : "current";
        const exemption = getDateRangeExemption({ chosenTenure, officialById, roster, selection });
        assert.deepEqual(exemption, { kind: "none" });
    }
});

test("a country without former officials never drops the date range", () => {
    const exemption = getDateRangeExemption({
        chosenTenure: "former",
        officialById,
        roster: [currentPm],
        selection: countrySelection,
    });
    assert.deepEqual(exemption, { kind: "none" });
});

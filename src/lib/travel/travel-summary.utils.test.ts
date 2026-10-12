import assert from "node:assert/strict";
import { test } from "node:test";

import { isTripInProgress } from "@/lib/travel/travel-summary.utils";
import type { TravelRecord } from "@/types/travel.types";

const trip = (overrides: Partial<TravelRecord>) =>
    ({
        datePrecision: "day",
        endDate: "2026-10-14",
        startDate: "2026-10-10",
        status: "upcoming",
        ...overrides,
    }) as TravelRecord;

test("isTripInProgress needs an exact date within the trip and a scheduled status", () => {
    assert.equal(isTripInProgress(trip({}), "2026-10-12"), true);
    assert.equal(isTripInProgress(trip({}), "2026-10-15"), false);
    assert.equal(isTripInProgress(trip({ status: "cancelled" }), "2026-10-12"), false);
});

test("isTripInProgress never counts a trip known only by month or year", () => {
    const year = trip({ datePrecision: "year", endDate: "2026-12-31", startDate: "2026-01-01" });
    const month = trip({ datePrecision: "month", endDate: "2026-10-31", startDate: "2026-10-01" });
    assert.equal(isTripInProgress(year, "2026-10-12"), false);
    assert.equal(isTripInProgress(month, "2026-10-12"), false);
});

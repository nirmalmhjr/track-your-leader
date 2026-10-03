import assert from "node:assert/strict";
import { test } from "node:test";

import { parseTripDates } from "../extract/trip-dates.parse";

test("day range within a month uses the section year", () => {
    assert.deepEqual(parseTripDates("15–16 June", 2014), {
        endDate: "2014-06-16",
        precision: "day",
        startDate: "2014-06-15",
    });
});

test("range across months", () => {
    assert.deepEqual(parseTripDates("30 November – 2 December", 2018), {
        endDate: "2018-12-02",
        precision: "day",
        startDate: "2018-11-30",
    });
});

test("month-first dates with an explicit year", () => {
    assert.deepEqual(parseTripDates("June 15–16, 2014", null), {
        endDate: "2014-06-16",
        precision: "day",
        startDate: "2014-06-15",
    });
});

test("range across New Year takes the year from the end", () => {
    assert.deepEqual(parseTripDates("28 December – 3 January 2020", null), {
        endDate: "2020-01-03",
        precision: "day",
        startDate: "2019-12-28",
    });
});

test("range across New Year without years moves the end forward", () => {
    assert.deepEqual(parseTripDates("30 December – 2 January", 2022), {
        endDate: "2023-01-02",
        precision: "day",
        startDate: "2022-12-30",
    });
});

test("weekdays, ordinals and 'to' are ignored", () => {
    assert.deepEqual(parseTripDates("Monday, 3rd to 5th August", 2014), {
        endDate: "2014-08-05",
        precision: "day",
        startDate: "2014-08-03",
    });
});

test("a missing space before the month and plain hyphens are tolerated", () => {
    assert.deepEqual(parseTripDates("14–16October", 2015), {
        endDate: "2015-10-16",
        precision: "day",
        startDate: "2015-10-14",
    });
    assert.deepEqual(parseTripDates("October 5-8", 2026), {
        endDate: "2026-10-08",
        precision: "day",
        startDate: "2026-10-05",
    });
});

test("month-only announcements keep month precision", () => {
    assert.deepEqual(parseTripDates("June 2027", null), {
        endDate: "2027-06-30",
        precision: "month",
        startDate: "2027-06-01",
    });
});

test("year-only announcements keep year precision", () => {
    assert.deepEqual(parseTripDates("TBA 2027", null), {
        endDate: "2027-12-31",
        precision: "year",
        startDate: "2027-01-01",
    });
});

test("dates without any year are rejected", () => {
    assert.equal(parseTripDates("15 June", null), null);
});

test("impossible dates are rejected", () => {
    assert.equal(parseTripDates("31 April", 2020), null);
});

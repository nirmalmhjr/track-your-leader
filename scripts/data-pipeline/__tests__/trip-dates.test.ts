import assert from "node:assert/strict";
import { test } from "node:test";

import { parseTripDates } from "../extract/trip-dates.parse";
import { isoFromParts, persianToIso } from "../lib/dates";

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

test("years before 1000 keep four digits so dates sort as text", () => {
    assert.equal(isoFromParts(947, 1, 1), "0947-01-01");
    assert.ok(isoFromParts(962, 1, 1) < "1980-01-01");
});

test("Spanish and French dates", () => {
    const range = (startDate: string, endDate: string) => ({
        endDate,
        precision: "day",
        startDate,
    });
    assert.deepEqual(
        parseTripDates("15 de junio de 2014", null),
        range("2014-06-15", "2014-06-15")
    );
    assert.deepEqual(
        parseTripDates("Del 15 al 17 de junio", 2014),
        range("2014-06-15", "2014-06-17")
    );
    assert.deepEqual(
        parseTripDates("30 de noviembre al 2 de diciembre de 2018", null),
        range("2018-11-30", "2018-12-02")
    );
    assert.deepEqual(parseTripDates("1er–3 juin 2014", null), range("2014-06-01", "2014-06-03"));
    assert.deepEqual(
        parseTripDates("28 février au 2 mars 1960", null),
        range("1960-02-28", "1960-03-02")
    );
    assert.deepEqual(parseTripDates("août 1962", null), {
        endDate: "1962-08-31",
        precision: "month",
        startDate: "1962-08-01",
    });
});

test("dates on the other Wikipedias read", () => {
    const day = (startDate: string, endDate = startDate) => ({
        endDate,
        precision: "day",
        startDate,
    });
    assert.deepEqual(
        parseTripDates("15 e 16 de janeiro de 2003", null),
        day("2003-01-15", "2003-01-16")
    );
    assert.deepEqual(
        parseTripDates("3 a 5 de março de 2010", null),
        day("2010-03-03", "2010-03-05")
    );
    assert.deepEqual(parseTripDates("30.–31. März", 2017), day("2017-03-30", "2017-03-31"));
    assert.deepEqual(
        parseTripDates("12. bis 14. Juni 2019", null),
        day("2019-06-12", "2019-06-14")
    );
    assert.deepEqual(parseTripDates("8–12 November", 2014), day("2014-11-08", "2014-11-12"));
    assert.deepEqual(parseTripDates("6월 16일 - 6월 18일", 2025), day("2025-06-16", "2025-06-18"));
    assert.deepEqual(
        parseTripDates("2024/9/11 – 2024/9/13", null),
        day("2024-09-11", "2024-09-13")
    );
});

test("Persian-calendar dates in Persian digits become Gregorian", () => {
    assert.equal(persianToIso(1403, 1, 1), "2024-03-20");
    assert.equal(persianToIso(1399, 12, 30), "2021-03-20");
    assert.equal(persianToIso(1403, 7, 31), null);
    assert.deepEqual(parseTripDates("۱۴۰۳/۶/۲۱ – ۱۴۰۳/۶/۲۲", null), {
        endDate: "2024-09-12",
        precision: "day",
        startDate: "2024-09-11",
    });
});

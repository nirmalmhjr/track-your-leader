import assert from "node:assert/strict";
import { test } from "node:test";

import type { DatePrecision } from "@/types/travel.types";

import { careerOf, repairYearTypo } from "../extract/trip-dates.repair";

const trip = (startDate: string, endDate: string, datePrecision: DatePrecision = "day") => ({
    datePrecision,
    endDate,
    startDate,
});

test("an end year typed a century out is read in the start's year", () => {
    assert.deepEqual(repairYearTypo(trip("2017-08-21", "2107-08-25"), null), {
        datePrecision: "day",
        endDate: "2017-08-25",
        startDate: "2017-08-21",
    });
    assert.equal(repairYearTypo(trip("2022-06-21", "2202-06-22"), null).endDate, "2022-06-22");
});

test("an end typed a year after the start keeps the start", () => {
    assert.equal(repairYearTypo(trip("2019-10-24", "2020-10-25"), null).endDate, "2019-10-25");
});

test("a trip crossing New Year with the end typed a year late stays across New Year", () => {
    assert.deepEqual(repairYearTypo(trip("2017-12-28", "2019-01-02"), null), {
        datePrecision: "day",
        endDate: "2018-01-02",
        startDate: "2017-12-28",
    });
});

test("a mistyped start is fixed when only that reading falls within the career", () => {
    const career = { from: "2022-10-25", to: "2026-10-12" };
    assert.deepEqual(repairYearTypo(trip("2002-12-10", "2022-12-13"), career), {
        datePrecision: "day",
        endDate: "2022-12-13",
        startDate: "2022-12-10",
    });
});

test("real long stays, loose dates and short trips are left alone", () => {
    const stays = [
        trip("1983-06-20", "1985-10-31"),
        trip("2010-05-30", "2011-04-01"),
        trip("2006-01-01", "2006-12-31", "year"),
        trip("2024-03-01", "2024-03-05"),
    ];
    for (const stay of stays) {
        assert.equal(repairYearTypo(stay, null), stay);
    }
});

test("careerOf spans the offices, open-ended ones running to today", () => {
    assert.deepEqual(
        careerOf(
            [
                { endDate: "2019-07-24", startDate: "2017-06-13" },
                { endDate: null, startDate: "2022-09-06" },
                { endDate: null, startDate: null },
            ],
            "2026-10-12"
        ),
        { from: "2017-06-13", to: "2026-10-12" }
    );
    assert.equal(careerOf([{ endDate: null, startDate: null }], "2026-10-12"), null);
});

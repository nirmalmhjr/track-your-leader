import assert from "node:assert/strict";
import { test } from "node:test";

import {
    buildTripsCsv,
    buildTripsFileName,
    escapeCsvCell,
    TRIPS_CSV_COLUMNS,
} from "@/lib/travel/trips-csv";
import type { Official, Place, TravelRecord } from "@/types/travel.types";

const BASE_URL = "https://example.org";
const BYTE_ORDER_MARK = "﻿";

const kathmandu: Place = {
    city: "Kathmandu",
    coordinates: [85.324, 27.7172],
    countryCode: "NPL",
    region: "Asia",
};

const official: Official = {
    countryCode: "NPL",
    fullName: "Bidya Devi Bhandari",
    id: "bidya-devi-bhandari",
    party: null,
    photoUrl: null,
    positions: [],
    sources: [],
    summary: "",
    wikidataId: null,
};

const record = (overrides: Partial<TravelRecord> = {}): TravelRecord => ({
    datePrecision: "day",
    destination: {
        city: "Brasília",
        coordinates: [-47.882, -15.794],
        countryCode: "BRA",
        region: "Americas",
    },
    endDate: "2019-06-03",
    engagements: ["Met the president", "Visited parliament"],
    eventName: null,
    id: "trip-1",
    officialId: official.id,
    origin: kathmandu,
    originCountryCode: "NPL",
    positionTitle: "President of Nepal",
    purpose: "State visit",
    sources: [{ label: "MOFA", url: "https://mofa.gov.np/a" }],
    startDate: "2019-06-01",
    status: "completed",
    type: "state_visit",
    ...overrides,
});

const parseRows = (csv: string): string[] => csv.slice(BYTE_ORDER_MARK.length).split("\r\n");

test("escapeCsvCell leaves plain text alone", () => {
    assert.equal(escapeCsvCell("Kathmandu"), "Kathmandu");
});

test("escapeCsvCell quotes commas, quotes and line breaks", () => {
    assert.equal(escapeCsvCell("Paris, France"), '"Paris, France"');
    assert.equal(escapeCsvCell('The "Big" summit'), '"The ""Big"" summit"');
    assert.equal(escapeCsvCell("Line one\nLine two"), '"Line one\nLine two"');
});

test("escapeCsvCell neutralises spreadsheet formulas", () => {
    assert.equal(escapeCsvCell("=HYPERLINK(1)"), "'=HYPERLINK(1)");
    assert.equal(escapeCsvCell("+1"), "'+1");
    assert.equal(escapeCsvCell("-1"), "'-1");
    assert.equal(escapeCsvCell("@SUM(A1)"), "'@SUM(A1)");
    assert.equal(escapeCsvCell("=A1,B1"), '"\'=A1,B1"');
});

test("buildTripsCsv starts with a byte order mark and the header row", () => {
    const csv = buildTripsCsv({
        baseUrl: BASE_URL,
        officialById: new Map([[official.id, official]]),
        records: [],
    });
    assert.ok(csv.startsWith(BYTE_ORDER_MARK));
    assert.equal(parseRows(csv)[0], TRIPS_CSV_COLUMNS.map((column) => column.header).join(","));
    assert.ok(csv.endsWith("\r\n"));
});

test("buildTripsCsv writes one row per trip in column order", () => {
    const csv = buildTripsCsv({
        baseUrl: BASE_URL,
        officialById: new Map([[official.id, official]]),
        records: [record()],
    });
    const rows = parseRows(csv);
    assert.equal(
        rows[1],
        [
            "2019-06-01",
            "2019-06-03",
            "Completed",
            "Bidya Devi Bhandari",
            "President of Nepal",
            "Nepal",
            "NPL",
            "Brasília",
            "Brazil",
            "BRA",
            "State visit",
            "",
            "State visit",
            "Met the president; Visited parliament",
            "MOFA: https://mofa.gov.np/a",
            "https://example.org/leaders/npl/bidya-devi-bhandari",
        ].join(",")
    );
});

test("buildTripsCsv leaves the city blank when only the country is known", () => {
    const csv = buildTripsCsv({
        baseUrl: BASE_URL,
        officialById: new Map(),
        records: [
            record({
                destination: {
                    city: "Washington",
                    coordinates: [-77.0369, 38.9072],
                    countryCode: "USA",
                    precision: "country",
                    region: "Americas",
                },
            }),
        ],
    });
    const cells = parseRows(csv)[1].split(",");
    const cityIndex = TRIPS_CSV_COLUMNS.findIndex((column) => column.header === "Destination city");
    assert.equal(cells[cityIndex], "");
});

test("buildTripsCsv falls back to the official id for unknown officials", () => {
    const csv = buildTripsCsv({ baseUrl: BASE_URL, officialById: new Map(), records: [record()] });
    const cells = parseRows(csv)[1].split(",");
    const officialIndex = TRIPS_CSV_COLUMNS.findIndex((column) => column.header === "Official");
    assert.equal(cells[officialIndex], "bidya-devi-bhandari");
});

test("buildTripsFileName slugs the subject and dates the file", () => {
    assert.equal(
        buildTripsFileName({
            filtered: false,
            subject: ["Côte d'Ivoire", "officials", "trips"],
            updatedOn: "2026-10-04",
        }),
        "cote-d-ivoire-officials-trips-2026-10-04.csv"
    );
});

test("buildTripsFileName marks filtered files", () => {
    assert.equal(
        buildTripsFileName({
            filtered: true,
            subject: ["Visits to", "Nepal"],
            updatedOn: "2026-10-04",
        }),
        "visits-to-nepal-filtered-2026-10-04.csv"
    );
});

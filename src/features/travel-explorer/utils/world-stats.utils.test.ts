import assert from "node:assert/strict";
import { test } from "node:test";

import { buildSampleTravelDataset } from "@/features/travel-explorer/data/sample/sample-dataset";
import {
    decodeWorldStatsFile,
    encodeWorldStatsFile,
    INDEX_VERSION,
    type TravelIndex,
    worldStatsFileSchema,
} from "@/features/travel-explorer/data/travel-index";
import { EMPTY_FILTERS } from "@/features/travel-explorer/utils/filters.utils";
import { countTrips } from "@/features/travel-explorer/utils/travel-aggregates.utils";
import {
    computeWorldStats,
    matchWorldTravel,
} from "@/features/travel-explorer/utils/world-stats.utils";
import { groupOfficialsByCountry } from "@/lib/travel/officials.utils";
import { summarizeTravel } from "@/lib/travel/travel-summary.utils";

const TODAY = "2026-10-12";
const { countries, officials, records } = buildSampleTravelDataset(TODAY);
const officialsByCountry = groupOfficialsByCountry(officials);

const statsFor = (filters: typeof EMPTY_FILTERS) =>
    computeWorldStats({
        ...matchWorldTravel(officials, records, filters),
        officialsByCountry,
    });

test("computeWorldStats gives the numbers the world view used to work out from the trips", () => {
    for (const filters of [EMPTY_FILTERS, { ...EMPTY_FILTERS, from: "2026-01-01" }]) {
        const { matchingRecords, matchingOfficialCount } = matchWorldTravel(
            officials,
            records,
            filters
        );
        const stats = statsFor(filters);
        const summary = summarizeTravel(matchingRecords);

        assert.ok(matchingRecords.length > 0);
        assert.equal(stats.officialCount, matchingOfficialCount);
        assert.equal(stats.tripCount, summary.tripCount);
        assert.equal(stats.upcomingCount, summary.upcomingCount);
        assert.deepEqual(
            stats.tripsByOrigin,
            countTrips(matchingRecords, (record) => record.originCountryCode)
        );
        assert.deepEqual(
            stats.visitsByDestination,
            countTrips(matchingRecords, (record) => record.destination.countryCode)
        );
        assert.equal(
            stats.tripsByStatus.cancelled,
            matchingRecords.filter((record) => record.status === "cancelled").length
        );
        for (const [code, list] of officialsByCountry) {
            assert.equal(stats.officialsByCountry.get(code), list.length);
        }
    }
});

test("the world stats file keeps every number through encoding, JSON and decoding", () => {
    const stats = statsFor(EMPTY_FILTERS);
    const index: TravelIndex = {
        countries: countries.map((country) => [
            country.code,
            country.capital.city,
            country.capital.coordinates[0],
            country.capital.coordinates[1],
            country.governmentSystem,
        ]),
        officials: [],
        places: [],
        trips: [],
        updatedOn: TODAY,
        version: INDEX_VERSION,
    };
    const file = worldStatsFileSchema.parse(
        JSON.parse(JSON.stringify(encodeWorldStatsFile(index, stats, TODAY)))
    );
    const decoded = decodeWorldStatsFile(file);

    assert.deepEqual(decoded.stats, stats);
    assert.deepEqual(
        decoded.countries.map((country) => country.code),
        countries.map((country) => country.code)
    );
    assert.equal(decoded.asOf, TODAY);
});

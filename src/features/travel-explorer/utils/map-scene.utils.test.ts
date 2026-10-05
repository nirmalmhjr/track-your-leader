import assert from "node:assert/strict";
import { test } from "node:test";

import type { ExplorerSelection } from "@/features/travel-explorer/types/explorer.types";
import { buildMapScene } from "@/features/travel-explorer/utils/map-scene.utils";
import type { TravelRecord } from "@/types/travel.types";

const kathmandu = { city: "Kathmandu", coordinates: [85.3, 27.7], countryCode: "NPL" };
const delhi = { city: "New Delhi", coordinates: [77.2, 28.6], countryCode: "IND" };

const oldTrip = {
    destination: delhi,
    endDate: "2016-02-23",
    id: "t1",
    officialId: "former-pm",
    origin: kathmandu,
    originCountryCode: "NPL",
    startDate: "2016-02-19",
    status: "completed",
} as unknown as TravelRecord;

const records = [oldTrip];
const byOrigin = new Map([["NPL", records]]);
const byOfficial = new Map([["former-pm", records]]);

const sceneFor = (selection: ExplorerSelection, isFormerSide: boolean) =>
    buildMapScene({
        countryByCode: new Map(),
        isFormerSide,
        matchingRecords: records,
        recordsByDestination: new Map(),
        recordsByOfficial: byOfficial,
        recordsByOrigin: byOrigin,
        selection,
    });

const country: ExplorerSelection = {
    country: "NPL",
    official: null,
    trip: null,
    view: "officials",
};

test("the former side holds routes back until an official is picked", () => {
    const scene = sceneFor(country, true);
    assert.equal(scene.routesHidden, true);
    assert.equal(scene.segments.length, 0);
    assert.equal(scene.nodes.length, 0);
    assert.equal(scene.values.size, 0);
    assert.equal(scene.records.length, 1);
});

test("a picked former official's routes are drawn", () => {
    const scene = sceneFor({ ...country, official: "former-pm" }, false);
    assert.equal(scene.routesHidden, false);
    assert.equal(scene.segments.length, 1);
});

test("the in-office side draws the country's routes", () => {
    const scene = sceneFor(country, false);
    assert.equal(scene.routesHidden, false);
    assert.equal(scene.segments.length, 1);
});

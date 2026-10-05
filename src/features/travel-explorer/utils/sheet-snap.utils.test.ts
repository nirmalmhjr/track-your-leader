import assert from "node:assert/strict";
import { test } from "node:test";

import {
    getNextSheetSnap,
    getSheetSnapOffsets,
    pickSheetSnap,
    raiseSheetSnap,
} from "@/features/travel-explorer/utils/sheet-snap.utils";

const offsets = getSheetSnapOffsets(800, 120);

test("snap offsets measure down from fully open", () => {
    assert.deepEqual(offsets, { full: 0, half: 400, peek: 680 });
});

test("half never sits below peek on a short screen", () => {
    assert.deepEqual(getSheetSnapOffsets(200, 150), { full: 0, half: 50, peek: 50 });
});

test("a slow release settles on the nearest snap", () => {
    assert.equal(pickSheetSnap(offsets, 30, 0), "full");
    assert.equal(pickSheetSnap(offsets, 450, 0.1), "half");
    assert.equal(pickSheetSnap(offsets, 600, -0.1), "peek");
});

test("a flick moves on to the next snap in its direction", () => {
    assert.equal(pickSheetSnap(offsets, 410, 1), "peek");
    assert.equal(pickSheetSnap(offsets, 390, -1), "full");
    assert.equal(pickSheetSnap(offsets, 650, -1), "half");
});

test("a flick past the last snap stays on it", () => {
    assert.equal(pickSheetSnap(offsets, 680, 1), "peek");
    assert.equal(pickSheetSnap(offsets, 0, -1), "full");
});

test("the handle steps up and wraps back down", () => {
    assert.equal(getNextSheetSnap("peek"), "half");
    assert.equal(getNextSheetSnap("half"), "full");
    assert.equal(getNextSheetSnap("full"), "peek");
});

test("raising only lifts a peeking sheet", () => {
    assert.equal(raiseSheetSnap("peek"), "half");
    assert.equal(raiseSheetSnap("full"), "full");
});

import assert from "node:assert/strict";
import { test } from "node:test";

import { TERRAIN_TILES } from "@/features/travel-explorer/constants/map-style.constants";
import {
    getTerrainGrid,
    getTerrainTiles,
    pickTerrainLevel,
    WORLD_BOUNDS,
} from "@/features/travel-explorer/utils/terrain-tiles.utils";

test("pickTerrainLevel matches the world's width on screen and stays within the built levels", () => {
    assert.equal(pickTerrainLevel(1), 0);
    assert.equal(pickTerrainLevel(1300), 0);
    assert.equal(pickTerrainLevel(2800), 1);
    assert.equal(pickTerrainLevel(8000), 3);
    assert.equal(pickTerrainLevel(1_000_000), TERRAIN_TILES.maxLevel);
});

test("getTerrainTiles covers the whole map with every tile of a level", () => {
    for (let level = 0; level <= TERRAIN_TILES.maxLevel; level += 1) {
        const { columns, rows } = getTerrainGrid(level);
        const tiles = getTerrainTiles(level, WORLD_BOUNDS);
        assert.equal(tiles.length, columns * rows);
        assert.equal(columns * tiles[0].size, WORLD_BOUNDS[1][0]);
        assert.ok(rows * tiles[0].size >= WORLD_BOUNDS[1][1]);
    }
});

test("getTerrainTiles returns only the tiles overlapping the view", () => {
    // Level 1 tiles are 250 map units square.
    const tiles = getTerrainTiles(1, [
        [240, 10],
        [260, 20],
    ]);
    assert.deepEqual(
        tiles.map((tile) => tile.url),
        ["/geo/terrain/1/0-0.webp", "/geo/terrain/1/1-0.webp"]
    );
    assert.deepEqual(
        getTerrainTiles(1, [
            [-500, -500],
            [-10, -10],
        ]),
        []
    );
});

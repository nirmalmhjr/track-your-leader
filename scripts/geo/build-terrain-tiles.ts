/**
 * Rebuilds the imagery behind the map's terrain style: `pnpm geo:terrain`.
 *
 * Source: Natural Earth II with Shaded Relief, Water, and Drainages, 1:10m (21,600 × 10,800 px,
 * public domain), a plate carrée image. Every output pixel is traced back to its longitude and
 * latitude through the map's own projection, so coastlines meet the country outlines exactly,
 * the seam in the Bering Strait included. The sea-floor relief is flattened into one water
 * colour, as on a road map, and below the map's southern edge the tiles are plain water, so the
 * imagery runs seamlessly into the ocean drawn around it.
 *
 * Writes `public/geo/terrain/{level}/{column}-{row}.webp` (see `TERRAIN_TILES`) and prints the
 * water colour, which `globals.css` uses for that ocean. Needs `curl` and `unzip` on the PATH.
 * Pass the path of an already-downloaded zip to skip the 330 MB download.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import sharp from "sharp";

import { MAP_CONFIG } from "@/features/travel-explorer/constants/explorer.constants";
import { TERRAIN_TILES } from "@/features/travel-explorer/constants/map-style.constants";
import {
    MAP_WORLD_HEIGHT,
    WORLD_PROJECTION,
} from "@/features/travel-explorer/utils/map-geometry.utils";
import { getTerrainGrid } from "@/features/travel-explorer/utils/terrain-tiles.utils";

const SOURCE_URL = "https://naciscdn.org/naturalearth/10m/raster/NE2_HR_LC_SR_W_DR.zip";
const SOURCE_IMAGE = "NE2_HR_LC_SR_W_DR.tif";
const OUTPUT_DIR = resolve(import.meta.dirname, "../../public/geo/terrain");
const WEBP_QUALITY = 78;
const CHANNELS = 3;
/**
 * Blue minus red of a pixel: about 90 for the imagery's water and under 25 for any land, ice or
 * snow. Pixels between the two bounds are coastline and blend into the water colour gradually.
 */
const WATER_BLUENESS = { land: 30, water: 80 } as const;

type Rgb = readonly [red: number, green: number, blue: number];

interface Raster {
    data: Buffer;
    height: number;
    width: number;
}

const step = (message: string): void => {
    process.stdout.write(`> ${message}\n`);
};

/**
 * The source shrunk to the level's width, so one source pixel spans one output pixel at the
 * equator. Mercator only stretches towards the poles, so no level is sampled below its own
 * resolution, which would alias.
 */
const loadSource = async (sourcePath: string, width: number): Promise<Raster> => {
    const { data, info } = await sharp(sourcePath, { limitInputPixels: false })
        .removeAlpha()
        .resize(width, width / 2, { fit: "fill" })
        .raw()
        .toBuffer({ resolveWithObject: true });
    return { data, height: info.height, width: info.width };
};

/** Bilinear sample of a plate carrée raster, wrapping around the antimeridian. */
const sample = (raster: Raster, longitude: number, latitude: number): Rgb => {
    const { data, width, height } = raster;
    const x = ((longitude + 180) / 360) * width - 0.5;
    const y = Math.min(Math.max(((90 - latitude) / 180) * height - 0.5, 0), height - 1);
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const left = ((x0 % width) + width) % width;
    const right = (left + 1) % width;
    const top = y0 * width;
    const bottom = Math.min(y0 + 1, height - 1) * width;

    const channel = (offset: number): number => {
        const upper =
            data[(top + left) * CHANNELS + offset] * (1 - fx) +
            data[(top + right) * CHANNELS + offset] * fx;
        const lower =
            data[(bottom + left) * CHANNELS + offset] * (1 - fx) +
            data[(bottom + right) * CHANNELS + offset] * fx;
        return Math.round(upper * (1 - fy) + lower * fy);
    };
    return [channel(0), channel(1), channel(2)];
};

const toHex = (colour: Rgb): string =>
    `#${colour.map((value) => value.toString(16).padStart(2, "0")).join("")}`;

/** Mean colour of the pixels that are clearly water. */
const averageWater = ({ data }: Raster): Rgb => {
    const sums = [0, 0, 0];
    let count = 0;
    for (let index = 0; index < data.length; index += CHANNELS) {
        if (data[index + 2] - data[index] >= WATER_BLUENESS.water) {
            sums[0] += data[index];
            sums[1] += data[index + 1];
            sums[2] += data[index + 2];
            count += 1;
        }
    }
    return [Math.round(sums[0] / count), Math.round(sums[1] / count), Math.round(sums[2] / count)];
};

/** Paints water in the single water colour, in proportion to how much of the pixel is water. */
const flattenWater = (colour: Rgb, water: Rgb): Rgb => {
    const [red, green, blue] = colour;
    const share = Math.min(
        Math.max(
            (blue - red - WATER_BLUENESS.land) / (WATER_BLUENESS.water - WATER_BLUENESS.land),
            0
        ),
        1
    );
    if (share === 0) {
        return colour;
    }
    const mix = (value: number, target: number) => Math.round(value + (target - value) * share);
    return [mix(red, water[0]), mix(green, water[1]), mix(blue, water[2])];
};

/**
 * Longitude of every pixel column and latitude of every pixel row at a level. The projection is
 * Mercator turned about the poles only, so x depends on longitude alone and y on latitude alone.
 * Rows below the map's foot get `NaN` and are drawn as water.
 */
const pixelCoordinates = (level: number) => {
    const { columns, rows } = getTerrainGrid(level);
    const unitsPerPixel = MAP_CONFIG.worldWidth / (TERRAIN_TILES.baseWidthPx * 2 ** level);
    const invert = (point: [number, number]) => WORLD_PROJECTION.invert?.(point) ?? null;

    const longitudes = Float64Array.from(
        { length: columns * TERRAIN_TILES.tileSizePx },
        (_, column) => invert([(column + 0.5) * unitsPerPixel, MAP_WORLD_HEIGHT / 2])?.[0] ?? 0
    );
    const latitudes = Float64Array.from({ length: rows * TERRAIN_TILES.tileSizePx }, (_, row) => {
        const y = (row + 0.5) * unitsPerPixel;
        return y > MAP_WORLD_HEIGHT
            ? Number.NaN
            : (invert([MAP_CONFIG.worldWidth / 2, y])?.[1] ?? Number.NaN);
    });
    return { columns, latitudes, longitudes, rows };
};

/** Renders and writes every tile of one level, returning how many were written. */
const buildLevel = async (sourcePath: string, level: number, water: Rgb): Promise<number> => {
    const size = TERRAIN_TILES.tileSizePx;
    const source = await loadSource(sourcePath, TERRAIN_TILES.baseWidthPx * 2 ** level);
    const { columns, rows, longitudes, latitudes } = pixelCoordinates(level);
    const levelDir = join(OUTPUT_DIR, String(level));
    mkdirSync(levelDir, { recursive: true });

    for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
            const pixels = Buffer.alloc(size * size * CHANNELS);
            for (let y = 0; y < size; y += 1) {
                const latitude = latitudes[row * size + y];
                for (let x = 0; x < size; x += 1) {
                    const colour = Number.isNaN(latitude)
                        ? water
                        : flattenWater(
                              sample(source, longitudes[column * size + x], latitude),
                              water
                          );
                    pixels.set(colour, (y * size + x) * CHANNELS);
                }
            }
            // biome-ignore lint/performance/noAwaitInLoops: tiles are encoded one by one to keep memory flat.
            await sharp(pixels, { raw: { channels: CHANNELS, height: size, width: size } })
                .webp({ quality: WEBP_QUALITY })
                .toFile(join(levelDir, `${column}-${row}.webp`));
        }
    }
    return columns * rows;
};

const folderSize = (dir: string): number =>
    readdirSync(dir, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .reduce((total, entry) => total + statSync(join(entry.parentPath, entry.name)).size, 0);

const buildTerrainTiles = async (): Promise<void> => {
    const workDir = mkdtempSync(join(tmpdir(), "terrain-tiles-"));
    try {
        const archive = process.argv[2] ? resolve(process.argv[2]) : join(workDir, "terrain.zip");
        if (!process.argv[2]) {
            step(`Downloading ${SOURCE_URL}`);
            execFileSync("curl", [
                "--fail",
                "--location",
                "--silent",
                "--output",
                archive,
                SOURCE_URL,
            ]);
        }
        execFileSync("unzip", ["-q", archive, SOURCE_IMAGE, "-d", workDir]);
        const sourcePath = join(workDir, SOURCE_IMAGE);

        const water = averageWater(await loadSource(sourcePath, TERRAIN_TILES.baseWidthPx));
        rmSync(OUTPUT_DIR, { force: true, recursive: true });
        for (let level = 0; level <= TERRAIN_TILES.maxLevel; level += 1) {
            // biome-ignore lint/performance/noAwaitInLoops: each level holds a large source image; one at a time keeps memory flat.
            const count = await buildLevel(sourcePath, level, water);
            step(`Level ${level}: ${count} tiles`);
        }

        const megabytes = (folderSize(OUTPUT_DIR) / 1024 / 1024).toFixed(1);
        step(`Wrote ${megabytes} MB to ${OUTPUT_DIR}`);
        step(`Water colour for --map-ocean in the terrain style: ${toHex(water)}`);
    } finally {
        rmSync(workDir, { force: true, recursive: true });
    }
};

await buildTerrainTiles();

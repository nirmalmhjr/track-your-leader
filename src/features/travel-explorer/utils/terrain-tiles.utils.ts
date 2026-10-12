import { MAP_CONFIG } from "@/features/travel-explorer/constants/explorer.constants";
import { TERRAIN_TILES } from "@/features/travel-explorer/constants/map-style.constants";
import { type Bounds, MAP_WORLD_HEIGHT } from "@/features/travel-explorer/utils/map-geometry.utils";

export interface TerrainTile {
    column: number;
    level: number;
    row: number;
    /** Side of the square tile, in map units. */
    size: number;
    url: string;
    /** Top-left corner, in map units. */
    x: number;
    y: number;
}

/** The whole map, in map units. */
export const WORLD_BOUNDS: Bounds = [
    [0, 0],
    [MAP_CONFIG.worldWidth, MAP_WORLD_HEIGHT],
];

/** Side of one tile at a level, in map units. */
export const getTerrainTileSize = (level: number): number =>
    (MAP_CONFIG.worldWidth * TERRAIN_TILES.tileSizePx) / (TERRAIN_TILES.baseWidthPx * 2 ** level);

/** Columns and rows of tiles covering the map at a level; the last row runs past its foot. */
export const getTerrainGrid = (level: number): { columns: number; rows: number } => {
    const size = getTerrainTileSize(level);
    return {
        columns: Math.round(MAP_CONFIG.worldWidth / size),
        rows: Math.ceil(MAP_WORLD_HEIGHT / size),
    };
};

/**
 * Level whose imagery best matches the world's width on screen. Rounding in log space keeps the
 * imagery within √2 of its natural size, sharp enough without fetching more than needed.
 *
 * @param worldWidthPx - Device pixels the whole world spans at the current zoom.
 */
export const pickTerrainLevel = (worldWidthPx: number): number => {
    const level = Math.round(Math.log2(worldWidthPx / TERRAIN_TILES.baseWidthPx));
    return Math.min(Math.max(level, 0), TERRAIN_TILES.maxLevel);
};

/**
 * Tiles of one level that overlap an area of the map.
 *
 * @param level - Imagery level, 0 to `TERRAIN_TILES.maxLevel`.
 * @param view - Area in map units, usually the part of the map on screen.
 */
export const getTerrainTiles = (level: number, view: Bounds): TerrainTile[] => {
    const size = getTerrainTileSize(level);
    const { columns, rows } = getTerrainGrid(level);
    const [[left, top], [right, bottom]] = view;
    const firstColumn = Math.max(Math.floor(left / size), 0);
    const lastColumn = Math.min(Math.ceil(right / size), columns) - 1;
    const firstRow = Math.max(Math.floor(top / size), 0);
    const lastRow = Math.min(Math.ceil(bottom / size), rows) - 1;

    const tiles: TerrainTile[] = [];
    for (let row = firstRow; row <= lastRow; row += 1) {
        for (let column = firstColumn; column <= lastColumn; column += 1) {
            tiles.push({
                column,
                level,
                row,
                size,
                url: `${TERRAIN_TILES.urlPrefix}/${level}/${column}-${row}.webp`,
                x: column * size,
                y: row * size,
            });
        }
    }
    return tiles;
};

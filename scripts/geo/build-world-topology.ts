/**
 * Rebuilds the map's country outlines: `pnpm geo:build`.
 *
 * Source: Natural Earth 1:10m Admin 0 countries, the default dataset. Its boundaries follow
 * de facto control and are used on purpose instead of any country's point-of-view edition.
 * The outlines are simplified to about 20% of their vertices (still several times sharper than
 * Natural Earth 1:50m), Antarctica is dropped because the flat map crops it, and the result is
 * written as TopoJSON in the shape `map-geometry.utils.ts` expects: one `countries` object whose
 * features carry the ISO numeric `id` (omitted for uncoded territories) and a `name` property.
 *
 * Natural Earth cuts every polygon at 180°, but the map's edges sit elsewhere (see
 * `MAP_CONFIG.centralMeridian`), so the cut would show as a border through Russia and Fiji. The
 * data is therefore worked on in longitudes measured from the map's centre, where the map's
 * edges are ±180° and Natural Earth's cut lies inside the range: the two sides of the cut are
 * joined there, and the simplifier still recognises lat/long and works on the sphere. Longitudes
 * are shifted back at the end, so land east of 180° is stored past 180° (up to about 191°).
 *
 * Needs `curl` and `unzip` on the PATH; mapshaper is fetched on demand through `npx`.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import type { FeatureCollection, Position } from "geojson";

import { MAP_CONFIG } from "../../src/features/travel-explorer/constants/explorer.constants";

const SOURCE_URL = "https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_0_countries.zip";
const SOURCE_SHAPEFILE = "ne_10m_admin_0_countries.shp";
const MAPSHAPER = "mapshaper@0.7.76";
/** Share of vertices kept; about 91k points in total, e.g. Nepal 299 and India 1,995. */
const SIMPLIFY_SHARE = "20%";
const QUANTIZATION = 100_000;
const OUTPUT_PATH = resolve(import.meta.dirname, "../../public/geo/world-countries.topo.json");

const ANTIMERIDIAN = 180;
/** Longitude of the map's left and right edges. */
const SEAM_LONGITUDE = MAP_CONFIG.centralMeridian - ANTIMERIDIAN;
/** Where Natural Earth's 180° cut lies once longitudes are measured from the map's centre. */
const CUT_LONGITUDE = ANTIMERIDIAN - MAP_CONFIG.centralMeridian;
/**
 * Natural Earth's two sides of the 180° cut don't share exact vertices; points on the cut this
 * close in latitude (about 300 m, finer than the output's precision) are treated as one.
 */
const CUT_SNAP_DEGREES = 0.003;
const ON_CUT_TOLERANCE = 1e-6;

/** Natural Earth marks missing codes with "-99"; France and Norway only have the `_EH` code. */
const ID_EXPRESSION = [
    'id = ISO_N3_EH != "-99" ? ISO_N3_EH : (ISO_N3 != "-99" ? ISO_N3 : null)',
    "name = NAME",
    // Dissolve key that keeps uncoded territories apart from each other.
    'key = id || ("name:" + NAME)',
].join("; ");

interface TopologyGeometry {
    id?: string | null;
    properties?: Record<string, unknown>;
}

interface Topology {
    objects: { countries: { geometries: TopologyGeometry[] } };
}

const step = (message: string): void => {
    process.stdout.write(`> ${message}\n`);
};

const mapshaper = (args: string[]): void => {
    execFileSync("npx", ["--yes", MAPSHAPER, ...args], { stdio: "inherit" });
};

/** Every vertex of every polygon ring, as the mutable arrays inside the collection. */
const collectPositions = (collection: FeatureCollection): Position[] =>
    collection.features.flatMap(({ geometry }) => {
        if (geometry?.type === "Polygon") {
            return geometry.coordinates.flat();
        }
        if (geometry?.type === "MultiPolygon") {
            return geometry.coordinates.flat(2);
        }
        return [];
    });

/**
 * Pulls together the vertices on Natural Earth's cut that belong to the same point, so both
 * sides of the cut share an edge that the dissolve can remove.
 */
const snapCutVertices = (collection: FeatureCollection): number => {
    const onCut = collectPositions(collection)
        .filter(([longitude]) => Math.abs(longitude - CUT_LONGITUDE) < ON_CUT_TOLERANCE)
        .sort((a, b) => a[1] - b[1]);

    let cluster: Position[] = [];
    const settle = () => {
        const latitude = cluster.reduce((sum, position) => sum + position[1], 0) / cluster.length;
        for (const position of cluster) {
            position[0] = CUT_LONGITUDE;
            position[1] = latitude;
        }
    };
    for (const position of onCut) {
        if (cluster.length > 0 && position[1] - cluster[0][1] > CUT_SNAP_DEGREES) {
            settle();
            cluster = [];
        }
        cluster.push(position);
    }
    if (cluster.length > 0) {
        settle();
    }
    return onCut.length;
};

/** Keeps only `name` in the properties and drops null ids so uncoded features have none. */
const normaliseFeatures = (topology: Topology): number => {
    const { geometries } = topology.objects.countries;
    for (const geometry of geometries) {
        geometry.properties = { name: geometry.properties?.name };
        if (geometry.id === null) {
            geometry.id = undefined;
        }
    }
    return geometries.length;
};

const buildWorldTopology = (): void => {
    const workDir = mkdtempSync(join(tmpdir(), "world-topology-"));
    try {
        const archive = join(workDir, "countries.zip");
        step(`Downloading ${SOURCE_URL}`);
        execFileSync("curl", ["--fail", "--location", "--silent", "--output", archive, SOURCE_URL]);
        execFileSync("unzip", ["-q", archive, "-d", workDir]);

        const shiftedPath = join(workDir, "shifted.json");
        step(`Measuring longitudes from the map's centre (${MAP_CONFIG.centralMeridian}°)`);
        mapshaper([
            join(workDir, SOURCE_SHAPEFILE),
            "-rename-layers",
            "land",
            "-filter",
            'ISO_A3_EH != "ATA"',
            "-each",
            ID_EXPRESSION,
            "-filter-fields",
            "id,name,key",
            "-explode",
            // Land between 180° and the map's west edge belongs at the east edge.
            "-affine",
            "shift=360,0",
            `where=this.bounds[2] < ${SEAM_LONGITUDE}`,
            "-affine",
            `shift=${-MAP_CONFIG.centralMeridian},0`,
            // Islands straddling the map's edge are split there and the western slice moved
            // across too. Only they are clipped: clipping the whole layer loses the holes that
            // enclaves such as Lesotho and San Marino fill, and the dissolve then drops them.
            "-filter",
            `this.bounds[0] < -${ANTIMERIDIAN}`,
            "+",
            "name=straddling",
            "-filter",
            `this.bounds[0] >= -${ANTIMERIDIAN}`,
            "target=land",
            "-clip",
            `bbox=-${2 * ANTIMERIDIAN},-90,-${ANTIMERIDIAN},90`,
            "+",
            "name=wrapped",
            "target=straddling",
            "-affine",
            "shift=360,0",
            "target=wrapped",
            "-clip",
            `bbox=-${ANTIMERIDIAN},-90,${ANTIMERIDIAN},90`,
            "target=straddling",
            "-merge-layers",
            "target=land,straddling,wrapped",
            "-o",
            "format=geojson",
            shiftedPath,
        ]);

        const shifted = JSON.parse(readFileSync(shiftedPath, "utf8")) as FeatureCollection;
        const snappedCount = snapCutVertices(shifted);
        writeFileSync(shiftedPath, JSON.stringify(shifted));
        step(`Aligned ${snappedCount} vertices on the 180° cut`);

        const rawOutput = join(workDir, "countries.topo.json");
        step(`Joining countries and simplifying to ${SIMPLIFY_SHARE}`);
        mapshaper([
            shiftedPath,
            // Gap filling would swallow small islands and atoll lagoons.
            "-dissolve",
            "fields=key",
            "copy-fields=id,name",
            "gap-width=0",
            // Rebuilds the topology, or the simplifier restores the edges the dissolve removed.
            "-clean",
            "gap-width=0",
            "-simplify",
            "weighted",
            SIMPLIFY_SHARE,
            "keep-shapes",
            "-affine",
            `shift=${MAP_CONFIG.centralMeridian},0`,
            "-filter-fields",
            "id,name",
            "-rename-layers",
            "countries",
            "-o",
            "format=topojson",
            "id-field=id",
            `quantization=${QUANTIZATION}`,
            rawOutput,
        ]);

        const topology = JSON.parse(readFileSync(rawOutput, "utf8")) as Topology;
        const featureCount = normaliseFeatures(topology);
        writeFileSync(OUTPUT_PATH, JSON.stringify(topology));
        step(`Wrote ${featureCount} features to ${OUTPUT_PATH}`);
    } finally {
        rmSync(workDir, { force: true, recursive: true });
    }
};

buildWorldTopology();

/**
 * Full collection: `pnpm data:collect`. Fetches every source for every country into
 * `data/warehouse/`, then updates the app's files. Takes a while on a cold cache.
 *
 * Flags: `--since=1980` (offices held since that year; default 1945), `--countries=NPL,IND`
 * (or `tracked`, default `all`), `--sources=colt,historian` (default all), `--refresh`, `--resume`,
 * `--force`. See README.md in this folder.
 */
import { PIPELINE_CONFIG } from "./config";
import { log } from "./lib/log";
import { parseOptions, runPipeline } from "./pipeline";
import { TRIP_SOURCES } from "./types";

runPipeline(
    parseOptions(process.argv.slice(2), {
        countries: "all",
        force: false,
        refresh: false,
        resume: false,
        sinceYear: PIPELINE_CONFIG.warehouseSinceYear,
        sources: new Set(TRIP_SOURCES),
    })
).catch((error: unknown) => {
    log.warn(error instanceof Error ? (error.stack ?? error.message) : String(error));
    process.exitCode = 1;
});

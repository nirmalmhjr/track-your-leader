/**
 * Daily refresh: `pnpm data:sync`. Rebuilds the tracked countries from the fast sources
 * (Wikidata, CIA, Wikipedia, Nepal's foreign ministry), reuses what the bulk sources reported
 * at the last `pnpm data:collect`, and updates the app's files. Flags: `--refresh` bypasses the
 * local cache, `--force` writes even if counts dropped sharply. See README.md in this folder.
 */
import { PIPELINE_CONFIG } from "./config";
import { log } from "./lib/log";
import { parseOptions, runPipeline } from "./pipeline";

runPipeline(
    parseOptions(process.argv.slice(2), {
        countries: "tracked",
        force: false,
        refresh: false,
        sinceYear: PIPELINE_CONFIG.warehouseSinceYear,
        sources: new Set(["wikipedia", "nepal-mofa"]),
    })
).catch((error: unknown) => {
    log.warn(error instanceof Error ? (error.stack ?? error.message) : String(error));
    process.exitCode = 1;
});

/**
 * `pnpm data:search`: builds `public/data/search.json` and `world-stats.json` from the app index,
 * without fetching anything. Runs before every build.
 */
import { writeSearchFile } from "./extract/search.export";
import { writeWorldStatsFile } from "./extract/world-stats.export";
import { log } from "./lib/log";

Promise.all([writeSearchFile(), writeWorldStatsFile()]).catch((error: unknown) => {
    log.warn(error instanceof Error ? (error.stack ?? error.message) : String(error));
    process.exitCode = 1;
});

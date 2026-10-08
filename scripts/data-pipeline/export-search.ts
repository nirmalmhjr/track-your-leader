/**
 * `pnpm data:search`: builds `public/data/search.json` from the app index, without fetching
 * anything. Runs before every build.
 */
import { writeSearchFile } from "./extract/search.export";
import { log } from "./lib/log";

writeSearchFile().catch((error: unknown) => {
    log.warn(error instanceof Error ? (error.stack ?? error.message) : String(error));
    process.exitCode = 1;
});

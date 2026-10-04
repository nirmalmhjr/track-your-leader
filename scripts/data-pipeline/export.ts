/**
 * `pnpm data:export`: rebuilds the app's index (`public/data/index.json`) from the stored
 * country files, without fetching anything. Add `--force` to write even if counts dropped.
 */
import { writeAppIndex } from "./extract/app-index";
import { todayIso } from "./lib/dates";
import { log } from "./lib/log";

writeAppIndex(todayIso(), process.argv.includes("--force")).catch((error: unknown) => {
    log.warn(error instanceof Error ? (error.stack ?? error.message) : String(error));
    process.exitCode = 1;
});

/**
 * `pnpm data:audit`: checks the stored country files for duplicates, gaps and suspect records
 * (`data/warehouse/audit.json`), without fetching anything.
 */
import { writeAudit } from "./extract/audit";
import { todayIso } from "./lib/dates";
import { log } from "./lib/log";

writeAudit(todayIso())
    .then((counts) => {
        for (const [name, count] of Object.entries(counts)) {
            log.info(`${name}: ${count}`);
        }
    })
    .catch((error: unknown) => {
        log.warn(error instanceof Error ? (error.stack ?? error.message) : String(error));
        process.exitCode = 1;
    });

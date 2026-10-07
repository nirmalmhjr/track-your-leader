/**
 * `pnpm data:coverage`: rebuilds the coverage report (`data/warehouse/coverage.json`) from the
 * stored country files, without fetching anything: which leaders have years with few or no
 * trips on record, recent years first.
 */
import { THIN_YEAR_MAX_TRIPS, writeCoverageReport } from "./extract/coverage";
import { todayIso } from "./lib/dates";
import { log } from "./lib/log";

writeCoverageReport(todayIso())
    .then((summary) => {
        for (const { leaderYears, period, thin } of summary) {
            log.info(
                `${period}: ${thin} of ${leaderYears} leader-years have ${THIN_YEAR_MAX_TRIPS} trips or fewer`
            );
        }
    })
    .catch((error: unknown) => {
        log.warn(error instanceof Error ? (error.stack ?? error.message) : String(error));
        process.exitCode = 1;
    });

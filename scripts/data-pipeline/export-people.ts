/**
 * `pnpm data:people`: unpacks the people store (`data/warehouse/people/`) into
 * `public/data/people/`, without fetching anything. Runs before every build.
 */
import { writePeopleFiles } from "./extract/people.export";
import { log } from "./lib/log";

writePeopleFiles().catch((error: unknown) => {
    log.warn(error instanceof Error ? (error.stack ?? error.message) : String(error));
    process.exitCode = 1;
});

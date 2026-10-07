import { log } from "./log";

/**
 * A heartbeat for long runs: steps can go quiet for many minutes while requests wait on rate
 * limits, so every so often the run says which step it is on and how many requests it has made.
 */

const HEARTBEAT_MS = 20_000;
const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;

const requests = { cached: 0, downloaded: 0, retried: 0 };
const runStartedAt = Date.now();

/**
 * Counts one request for the heartbeat.
 *
 * @param kind - Served from the local cache, downloaded, or retried after an error.
 */
export const countRequest = (kind: keyof typeof requests): void => {
    requests[kind] += 1;
};

/** "1h 05m", "3m 20s", "45s". */
const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / MS_PER_SECOND);
    const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
    const hours = Math.floor(minutes / MINUTES_PER_HOUR);
    if (hours > 0) {
        return `${hours}h ${String(minutes % MINUTES_PER_HOUR).padStart(2, "0")}m`;
    }
    return minutes > 0 ? `${minutes}m ${seconds % SECONDS_PER_MINUTE}s` : `${seconds}s`;
};

/**
 * Prints a "still working" line every 20 seconds until the run ends.
 *
 * @returns Stops the heartbeat.
 */
export const startHeartbeat = (): (() => void) => {
    const timer = setInterval(() => {
        const { name, startedAt } = log.currentStep();
        const { cached, downloaded, retried } = requests;
        log.info(
            `… working: ${name} for ${formatDuration(Date.now() - startedAt)} ` +
                `(run ${formatDuration(Date.now() - runStartedAt)}; ` +
                `${cached.toLocaleString("en")} from cache, ` +
                `${downloaded.toLocaleString("en")} downloaded, ${retried.toLocaleString("en")} retried)`
        );
    }, HEARTBEAT_MS);
    // The heartbeat alone never keeps the process alive.
    timer.unref();
    return () => clearInterval(timer);
};

let step = { name: "Starting", startedAt: Date.now() };

/** Minimal console output for the pipeline (stdout for progress, stderr for warnings). */
export const log = {
    /** The step under way and when it started, for the heartbeat. */
    currentStep: (): { name: string; startedAt: number } => step,
    info: (message: string): void => {
        process.stdout.write(`  ${message}\n`);
    },
    step: (message: string): void => {
        step = { name: message, startedAt: Date.now() };
        process.stdout.write(`\n> ${message}\n`);
    },
    warn: (message: string): void => {
        process.stderr.write(`  ! ${message}\n`);
    },
};

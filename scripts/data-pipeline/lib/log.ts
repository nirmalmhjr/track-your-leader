/** Minimal console output for the pipeline (stdout for progress, stderr for warnings). */
export const log = {
    info: (message: string): void => {
        process.stdout.write(`  ${message}\n`);
    },
    step: (message: string): void => {
        process.stdout.write(`\n> ${message}\n`);
    },
    warn: (message: string): void => {
        process.stderr.write(`  ! ${message}\n`);
    },
};

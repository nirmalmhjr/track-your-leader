import { PIPELINE_CONFIG } from "../config";

/**
 * Detects suspicious drops between runs. If a source changes its layout, a parser can quietly
 * return far fewer rows; refusing to write keeps yesterday's good data online instead.
 *
 * @param label - What is being counted, for the message.
 * @param previous - Count in the committed files.
 * @param next - Count produced by this run.
 * @returns A problem description, or `null` when the change is within bounds.
 */
export const checkCountDrop = (label: string, previous: number, next: number): string | null => {
    if (previous === 0) {
        return null;
    }
    const drop = (previous - next) / previous;
    return drop > PIPELINE_CONFIG.maxCountDropRatio
        ? `${label} dropped from ${previous} to ${next} (more than ${PIPELINE_CONFIG.maxCountDropRatio * 100}%)`
        : null;
};

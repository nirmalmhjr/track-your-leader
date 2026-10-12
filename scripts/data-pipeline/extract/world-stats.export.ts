import { readFile, writeFile } from "node:fs/promises";

import {
    decodeTravelIndex,
    encodeWorldStatsFile,
    travelIndexSchema,
} from "@/features/travel-explorer/data/travel-index";
import { EMPTY_FILTERS } from "@/features/travel-explorer/utils/filters.utils";
import {
    computeWorldStats,
    matchWorldTravel,
} from "@/features/travel-explorer/utils/world-stats.utils";
import { toIsoDate } from "@/lib/travel/date.utils";
import { groupOfficialsByCountry } from "@/lib/travel/officials.utils";

import { PIPELINE_CONFIG } from "../config";
import { log } from "../lib/log";

const isMissingFile = (error: unknown): boolean =>
    error instanceof Error && "code" in error && error.code === "ENOENT";

/**
 * Builds `public/data/world-stats.json` from the app index: the countries and the world view's
 * numbers for the default filters, worked out with the app's own code so they match what the
 * explorer shows once the full index has loaded. It is generated (and git-ignored) rather than
 * committed, since the index already holds everything in it; `pnpm build` runs this first.
 */
export const writeWorldStatsFile = async (): Promise<void> => {
    let text: string;
    try {
        text = await readFile(PIPELINE_CONFIG.indexFile, "utf8");
    } catch (error) {
        if (isMissingFile(error)) {
            log.warn("No app index yet: the explorer will wait for the sample data instead");
            return;
        }
        throw error;
    }
    const index = travelIndexSchema.parse(JSON.parse(text));
    const today = toIsoDate(new Date());
    const { officials, recordsByOrigin } = decodeTravelIndex(index, today);
    const records = [...recordsByOrigin.values()].flat();
    const stats = computeWorldStats({
        ...matchWorldTravel(officials, records, EMPTY_FILTERS),
        officialsByCountry: groupOfficialsByCountry(officials),
    });
    await writeFile(
        PIPELINE_CONFIG.worldStatsFile,
        `${JSON.stringify(encodeWorldStatsFile(index, stats, today))}\n`,
        "utf8"
    );
    log.info(`World stats file: ${stats.tripCount} trips as of ${today}`);
};

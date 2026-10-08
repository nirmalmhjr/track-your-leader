import { readFile, writeFile } from "node:fs/promises";

import {
    encodeSearchIndex,
    serializeSearchIndex,
    travelIndexSchema,
} from "@/features/travel-explorer/data/travel-index";

import { PIPELINE_CONFIG } from "../config";
import { log } from "../lib/log";

const isMissingFile = (error: unknown): boolean =>
    error instanceof Error && "code" in error && error.code === "ENOENT";

/**
 * Builds `public/data/search.json` from the app index: each official's name, country, title,
 * whether they hold office and how many trips they made. The leaders pages search it without
 * loading every trip. It is generated (and git-ignored) rather than committed, since the index
 * already holds everything in it; `pnpm build` runs this first.
 */
export const writeSearchFile = async (): Promise<void> => {
    let text: string;
    try {
        text = await readFile(PIPELINE_CONFIG.indexFile, "utf8");
    } catch (error) {
        if (isMissingFile(error)) {
            log.warn("No app index yet: the search will read the sample data instead");
            return;
        }
        throw error;
    }
    const search = encodeSearchIndex(travelIndexSchema.parse(JSON.parse(text)));
    await writeFile(PIPELINE_CONFIG.searchFile, serializeSearchIndex(search), "utf8");
    log.info(`Search file: ${search.people.length} people`);
};

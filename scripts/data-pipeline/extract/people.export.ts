import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { PIPELINE_CONFIG } from "../config";
import { log } from "../lib/log";
import { readAllPeople, serializePeople } from "../lib/warehouse";

/**
 * Unpacks the people store into `public/data/people/<ISO3>.json`, the files the leaders pages
 * load. They are generated (and git-ignored) rather than committed, since the store already
 * holds them compressed; `pnpm build` runs this first.
 */
export const writePeopleFiles = async (): Promise<void> => {
    const people = await readAllPeople();
    await mkdir(PIPELINE_CONFIG.peopleDir, { recursive: true });
    let written = 0;
    for (const [code, rows] of people) {
        const file = path.join(PIPELINE_CONFIG.peopleDir, `${code}.json`);
        const next = serializePeople(rows);
        // biome-ignore lint/performance/noAwaitInLoops: files are compared and written one by one.
        const previous = await readFile(file, "utf8").catch(() => null);
        if (previous !== next) {
            await writeFile(file, next, "utf8");
            written += 1;
        }
    }
    const stale = (await readdir(PIPELINE_CONFIG.peopleDir)).filter(
        (name) => name.endsWith(".json") && !people.has(name.slice(0, -".json".length))
    );
    await Promise.all(stale.map((name) => rm(path.join(PIPELINE_CONFIG.peopleDir, name))));
    const total = [...people.values()].reduce((sum, rows) => sum + rows.length, 0);
    log.info(
        `People files: ${total} people in ${people.size} countries (${written} files written)`
    );
};

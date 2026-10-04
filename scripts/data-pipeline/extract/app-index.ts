import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { TRACKED_COUNTRIES } from "@/features/travel-explorer/data/tracked-countries";
import {
    encodeTravelIndex,
    serializeTravelIndex,
    travelIndexSchema,
} from "@/features/travel-explorer/data/travel-index";
import type { IsoDate, Place, TrackedCountry } from "@/features/travel-explorer/types/travel.types";

import { PIPELINE_CONFIG } from "../config";
import { log } from "../lib/log";
import { readCountries } from "../lib/warehouse";
import { checkCountDrop } from "../validate/guard";
import { readCapitals } from "./places.resolve";

/**
 * Writes `public/data/index.json`, the compact list of every country, official and trip that
 * the app loads first. It is rebuilt from the stored country files, so it always matches them.
 */

/** Capitals Wikidata doesn't return by ISO code (Kosovo uses the user-assigned code XKX). */
const CAPITAL_FALLBACKS: Readonly<Record<string, Place>> = {
    XKX: {
        city: "Pristina",
        coordinates: [21.1655, 42.6629],
        countryCode: "XKX",
        region: "Europe",
    },
};

const readPreviousIndex = async () => {
    try {
        const text = await readFile(PIPELINE_CONFIG.indexFile, "utf8");
        const parsed = travelIndexSchema.safeParse(JSON.parse(text));
        return parsed.success ? { index: parsed.data, text } : null;
    } catch {
        return null;
    }
};

/**
 * Rebuilds the app's index from the country files.
 *
 * @param today - Date recorded as the last update when the contents change.
 * @param force - Write even if counts dropped sharply.
 */
export const writeAppIndex = async (today: IsoDate, force: boolean): Promise<void> => {
    const stored = await readCountries();
    const capitals = await readCapitals();
    const featured = new Map(TRACKED_COUNTRIES.map((country) => [country.code, country]));

    const countries: TrackedCountry[] = [];
    for (const [code, file] of stored) {
        const capital =
            featured.get(code)?.capital ?? capitals.get(code) ?? CAPITAL_FALLBACKS[code];
        if (file.officials.length === 0) {
            continue;
        }
        if (!capital) {
            log.warn(`${code}: no capital known, left out of the app index`);
            continue;
        }
        countries.push({
            capital,
            code,
            governmentSystem: featured.get(code)?.governmentSystem ?? null,
            name: code,
        });
    }
    const included = new Set(countries.map((country) => country.code));
    const files = [...stored].filter(([code]) => included.has(code)).map(([, file]) => file);
    const officials = files.flatMap((file) => file.officials);
    const trips = files.flatMap((file) => file.trips);

    const previous = await readPreviousIndex();
    const problems = [
        checkCountDrop("App officials", previous?.index.officials.length ?? 0, officials.length),
        checkCountDrop("App trips", previous?.index.trips.length ?? 0, trips.length),
    ].filter((problem): problem is string => problem !== null);
    for (const problem of problems) {
        log.warn(problem);
    }
    if (problems.length > 0 && !force) {
        throw new Error(
            "App index not written. Check the warehouse report, then rerun with --force."
        );
    }

    // The update date only moves when the contents do, so quiet days produce no commit.
    const unchanged = previous
        ? serializeTravelIndex(
              encodeTravelIndex({
                  countries,
                  officials,
                  trips,
                  updatedOn: previous.index.updatedOn,
              })
          )
        : null;
    if (previous && unchanged === previous.text) {
        log.info(
            `App index unchanged: ${countries.length} countries, ${officials.length} officials, ${trips.length} trips`
        );
        return;
    }
    await mkdir(path.dirname(PIPELINE_CONFIG.indexFile), { recursive: true });
    await writeFile(
        PIPELINE_CONFIG.indexFile,
        serializeTravelIndex(encodeTravelIndex({ countries, officials, trips, updatedOn: today })),
        "utf8"
    );
    log.info(
        `App index: ${countries.length} countries, ${officials.length} officials, ${trips.length} trips`
    );
};

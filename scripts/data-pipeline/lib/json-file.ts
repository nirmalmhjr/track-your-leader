import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { z } from "zod";

const INDENT = 2;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

/** Rebuilds objects with sorted keys so files diff cleanly between runs. */
const sortKeys = (value: unknown): unknown => {
    if (Array.isArray(value)) {
        return value.map(sortKeys);
    }
    if (isPlainObject(value)) {
        return Object.fromEntries(
            Object.keys(value)
                .sort()
                .map((key) => [key, sortKeys(value[key])])
        );
    }
    return value;
};

/**
 * Serialises data the way every pipeline output is stored: sorted keys, two-space indent.
 *
 * @param data - Value to serialise.
 * @returns The file contents.
 */
export const serializeJson = (data: unknown): string =>
    `${JSON.stringify(sortKeys(data), null, INDENT)}\n`;

/**
 * Reads and validates a JSON file.
 *
 * @param file - Path relative to the repository root.
 * @param schema - Schema the contents must match.
 * @returns The parsed contents, or `null` when the file is missing or invalid.
 */
export const readJsonFile = async <T>(file: string, schema: z.ZodType<T>): Promise<T | null> => {
    try {
        const result = schema.safeParse(JSON.parse(await readFile(file, "utf8")));
        return result.success ? result.data : null;
    } catch {
        return null;
    }
};

/**
 * Writes a JSON file only when its contents change, keeping git history free of no-op commits.
 *
 * @param file - Path relative to the repository root.
 * @param data - Value to store.
 * @returns `true` when the file was created or changed.
 */
export const writeJsonFile = async (file: string, data: unknown): Promise<boolean> => {
    const next = serializeJson(data);
    const previous = await readFile(file, "utf8").catch(() => null);
    if (previous === next) {
        return false;
    }
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, next, "utf8");
    return true;
};

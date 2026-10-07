import { z } from "zod";

import { fetchJson } from "../lib/http";
import { normalizeName } from "../lib/text";
import { isPortraitFile } from "./wikipedia";

/**
 * Wikimedia Commons: the category a person's Wikidata item names (`P373`) holds the photos of
 * them, under free licences. One file whose name names the person is taken as their photo.
 */

const API = "https://commons.wikimedia.org/w/api.php";
const FILES_PER_CATEGORY = 50;
const TTL_HOURS = 30 * 24;
/** Name words shorter than this ("al", "de") don't identify anyone in a file name. */
const MIN_TOKEN_LENGTH = 3;
const FILE_PREFIX = /^File:/;

const membersSchema = z.object({
    query: z.object({ categorymembers: z.array(z.object({ title: z.string() })) }).optional(),
});

/**
 * A photo of the person from their Commons category: the first file whose name has every word of
 * theirs (three letters or more), that isn't a flag, map or signature.
 *
 * @param category - Category name without "Category:".
 * @param name - The person's name.
 * @returns The file name, or `null`.
 */
export const categoryPortrait = async (category: string, name: string): Promise<string | null> => {
    const json = await fetchJson(
        `${API}?${new URLSearchParams({
            action: "query",
            cmlimit: String(FILES_PER_CATEGORY),
            cmtitle: `Category:${category}`,
            cmtype: "file",
            format: "json",
            list: "categorymembers",
        })}`,
        { ttlHours: TTL_HOURS }
    );
    const tokens = normalizeName(name)
        .split(" ")
        .filter((token) => token.length >= MIN_TOKEN_LENGTH);
    if (tokens.length === 0) {
        return null;
    }
    const files = membersSchema.parse(json).query?.categorymembers ?? [];
    const match = files
        .map((file) => file.title.replace(FILE_PREFIX, ""))
        .find((file) => {
            const words = ` ${normalizeName(file)} `;
            return isPortraitFile(file) && tokens.every((token) => words.includes(` ${token} `));
        });
    return match ?? null;
};

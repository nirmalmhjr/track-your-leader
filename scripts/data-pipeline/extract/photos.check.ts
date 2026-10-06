import { normalizeName } from "../lib/text";

/** A person and the photo Wikidata gives them. */
export interface PhotoEntry {
    aliases: readonly string[];
    name: string;
    photoUrl: string | null;
    wikidataId: string | null;
}

/** A photo taken away from people it may not show. */
export interface DroppedPhoto {
    file: string;
    wikidataIds: string[];
}

/**
 * Photos to keep or block whatever the automatic check decides, keyed by Wikidata id. "keep"
 * suits a shared photo whose file name can't be matched (one in another script); "block" a
 * wrong photo used by nobody else. Better still, fix the person's image (P18) on Wikidata and
 * remove the entry.
 */
export const PHOTO_OVERRIDES: Readonly<Record<string, "keep" | "block">> = {
    // Onsari Gharti Magar: "ओनसरी घर्तिमगर पतिसँग" ("… with her husband"), also on Barsaman Pun.
    Q21129921: "keep",
};

/** Name words shorter than this ("of", "al", "de") don't identify anyone in a file name. */
const MIN_NAME_TOKEN_LENGTH = 3;
const FILE_PATH = /Special:FilePath\/([^?]+)/;
const FILE_EXTENSION = /\.[a-z0-9]+$/i;
/** " (cropped)", " (restoration)": the marks Commons puts on a copy derived from another file. */
const DERIVED_COPY_MARK = /\s*\((?:cropped|crop|restored|restoration|retouched|edited)\b[^)]*\)/gi;

/** The Commons file a photo URL points to, whatever thumbnail width it asks for. */
export const photoFileOf = (photoUrl: string): string => {
    const encoded = photoUrl.match(FILE_PATH)?.[1] ?? photoUrl;
    try {
        return decodeURIComponent(encoded).replaceAll("_", " ");
    } catch {
        return encoded;
    }
};

/**
 * The photo a file shows, so a cropped or restored copy counts as the same photo as its original
 * ("… पतिसँग (cropped).jpg" on Barsaman Pun, "… पतिसँग.jpg" on Onsari Gharti Magar).
 *
 * @param file - Commons file name.
 * @returns The file name without copy marks.
 */
export const originalPhotoOf = (file: string): string => file.replace(DERIVED_COPY_MARK, "");

/** Whether every word of one of the person's names appears in the file name. */
const isNamedIn = (entry: PhotoEntry, file: string): boolean => {
    const fileTokens = new Set(normalizeName(file.replace(FILE_EXTENSION, "")).split(" "));
    return [entry.name, ...entry.aliases].some((name) => {
        const tokens = normalizeName(name)
            .split(" ")
            .filter((token) => token.length >= MIN_NAME_TOKEN_LENGTH);
        return tokens.length > 0 && tokens.every((token) => fileTokens.has(token));
    });
};

/**
 * Finds photos that don't reliably show their person. Wikidata sometimes gives two people the
 * same file: a group photo, or a spouse's portrait ("Onsari Gharti Magar with her husband" as
 * Barsaman Pun's photo). Such a photo stays only with the people its file name names; when it
 * names nobody, everyone loses it. Overrides win over both rules.
 *
 * @param entries - Everyone with their photo, across countries.
 * @param overrides - Per Wikidata id, a photo to keep or block regardless.
 * @returns The Wikidata ids whose photo should be dropped, and the files dropped for the report.
 */
export const findUnreliablePhotos = (
    entries: readonly PhotoEntry[],
    overrides: Readonly<Record<string, "keep" | "block">> = PHOTO_OVERRIDES
): { dropped: DroppedPhoto[]; ids: Set<string> } => {
    const byFile = new Map<string, Map<string, PhotoEntry>>();
    for (const entry of entries) {
        if (entry.photoUrl && entry.wikidataId) {
            const file = originalPhotoOf(photoFileOf(entry.photoUrl));
            const holders = byFile.get(file) ?? new Map<string, PhotoEntry>();
            holders.set(entry.wikidataId, entry);
            byFile.set(file, holders);
        }
    }

    const ids = new Set<string>();
    const dropped: DroppedPhoto[] = [];
    for (const [file, holders] of byFile) {
        const isShared = holders.size > 1;
        const lost = [...holders.values()].filter((entry) => {
            const override = entry.wikidataId ? overrides[entry.wikidataId] : undefined;
            if (override) {
                return override === "block";
            }
            return isShared && !isNamedIn(entry, file);
        });
        if (lost.length > 0) {
            const lostIds = lost.flatMap((entry) => entry.wikidataId ?? []);
            for (const id of lostIds) {
                ids.add(id);
            }
            dropped.push({ file, wikidataIds: lostIds.sort() });
        }
    }
    return { dropped: dropped.sort((a, b) => a.file.localeCompare(b.file)), ids };
};

import { readFile } from "node:fs/promises";

import { extractText, getDocumentProxy } from "unpdf";

import { fetchFile } from "../lib/http";

/**
 * The World Health Organization's "list of delegates and other participants" for each World
 * Health Assembly (Geneva, every May): who every member state sent, health ministers first.
 * WHO documents may be reproduced with attribution.
 */

const BASE = "https://apps.who.int/gb/ebwha/pdf_files";
const HOURS_PER_YEAR = 24 * 365;

/**
 * The list of each assembly, final version where WHO published one. File names changed over
 * the years, so they are listed rather than guessed. 2020 and 2021 met online; the 2005 list
 * has no text layer to read, and 2000, 2001, 2008 and 2009 aren't published under any known name.
 */
export const WHO_ASSEMBLIES: readonly { file: string; number: number; year: number }[] = [
    { file: "WHA52/ewd1r1.pdf", number: 52, year: 1999 },
    { file: "WHA55/a55d1r1.pdf", number: 55, year: 2002 },
    { file: "WHA56/a56d1r1.pdf", number: 56, year: 2003 },
    { file: "WHA57/A57_DIV1REV1.pdf", number: 57, year: 2004 },
    { file: "WHA59/A59_DIV1REV1.pdf", number: 59, year: 2006 },
    { file: "WHA60/A60_DIV1.pdf", number: 60, year: 2007 },
    { file: "WHA63/A63_DIV1.pdf", number: 63, year: 2010 },
    { file: "WHA64/A64_DIV1.pdf", number: 64, year: 2011 },
    { file: "WHA65/A65_DIV1REV1.pdf", number: 65, year: 2012 },
    { file: "WHA66/WHA66_DIV1REV1-en.pdf", number: 66, year: 2013 },
    { file: "WHA67/A67_DIV1-en.pdf", number: 67, year: 2014 },
    { file: "WHA68/A68_DIV1-en.pdf", number: 68, year: 2015 },
    { file: "WHA69/A69_DIV1REV1-en.pdf", number: 69, year: 2016 },
    { file: "WHA70/WHA70_DIV1REV1-en.pdf", number: 70, year: 2017 },
    { file: "WHA71/A71_DIV1REV1-en.pdf", number: 71, year: 2018 },
    { file: "WHA72/A72_DIV1REV1-en.pdf", number: 72, year: 2019 },
    { file: "WHA75/A75_DIV1REV1-en.pdf", number: 75, year: 2022 },
    { file: "WHA76/A76_DIV1-en.pdf", number: 76, year: 2023 },
    { file: "WHA77/A77_DIV1REV1-en.pdf", number: 77, year: 2024 },
    { file: "WHA78/A78_DIV1REV1-en.pdf", number: 78, year: 2025 },
    { file: "WHA79/A79_DIV1-en.pdf", number: 79, year: 2026 },
];

/**
 * Public address of an assembly's list.
 *
 * @param file - Path under WHO's document folder.
 * @returns The PDF's URL.
 */
export const whoDocumentUrl = (file: string): string => `${BASE}/${file}`;

/**
 * Downloads an assembly's list and returns its text, one line per entry.
 *
 * @param file - Path under WHO's document folder.
 * @returns The lines, or `null` when the document can't be fetched or read.
 */
export const fetchDelegationLines = async (file: string): Promise<string[] | null> => {
    try {
        // Published lists don't change; a year-long cache spares WHO's servers.
        const path = await fetchFile(whoDocumentUrl(file), { ttlHours: HOURS_PER_YEAR });
        const pdf = await getDocumentProxy(new Uint8Array(await readFile(path)));
        const { text } = await extractText(pdf, { mergePages: false });
        return text.flatMap((page) => page.split("\n"));
    } catch {
        return null;
    }
};

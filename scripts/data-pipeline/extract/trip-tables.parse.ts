import { type CheerioAPI, load } from "cheerio";
import type { Element } from "domhandler";

import type { TravelStatusHint } from "@/features/travel-explorer/utils/travel-status.utils";

import { cleanText } from "../lib/text";

/**
 * Turns the tables of a Wikipedia trip-list page into rows of cells. Tables vary from page to
 * page, so columns are found by their header text and cells spanning several rows are
 * repeated into each row they cover. Anything that can't be read is reported, never guessed.
 */

export interface CellLink {
    /** Visible text, e.g. "Paro". */
    text: string;
    /** Linked article title, e.g. "Paro, Bhutan". */
    title: string;
}

export interface TableCell {
    links: CellLink[];
    text: string;
}

export interface TripRow {
    cities: TableCell | null;
    /** Year of the section heading, for date cells without a year. */
    contextYear: number | null;
    country: TableCell | null;
    date: string;
    notes: string | null;
    purpose: TableCell | null;
    /** Set by headings such as "Future trips" or "Cancelled visits". */
    sectionHint: TravelStatusHint;
}

export interface ParsedTripPage {
    rows: TripRow[];
    /** Header texts of tables that had no date or place column. */
    skippedTables: string[];
}

type ColumnKey = "cities" | "country" | "date" | "notes" | "purpose";

/** Checked in this order; each column is claimed by the first key that matches it. */
const COLUMN_PATTERNS: readonly (readonly [ColumnKey, RegExp])[] = [
    ["date", /\bdates?\b/],
    ["country", /\b(country|countries|nation|destination)\b/],
    ["cities", /\b(cit(y|ies)|areas?|locations?|places?|venues?|visited)\b/],
    ["purpose", /\b(purpose|reason|events?|type|activit(y|ies)|occasion|description)\b/],
    ["notes", /\b(notes?|details|highlights|remarks|summary)\b/],
];

const YEAR = /\b(?:19|20)\d{2}\b/g;
const FUTURE_HEADING = /\b(future|upcoming|scheduled|planned|proposed)\b/i;
const CANCELLED_HEADING = /\b(cancel+ed|postponed)\b/i;
const NON_ARTICLE_TITLE = /^(file|image|help|wikipedia|category|template|portal|special):/i;
const WIKI_LINK = "/wiki/";
const NOISE =
    "sup, style, .sortkey, .reference, .mw-ref, .hatnote, .noprint, [style*='display:none'], [style*='display: none']";

const readCell = ($: CheerioAPI, cell: Element): TableCell => {
    const copy = $(cell).clone();
    copy.find(`${NOISE}, table`).remove();
    const links = copy
        .find(`a[href^='${WIKI_LINK}']`)
        .not(".new")
        .toArray()
        .flatMap((anchor): CellLink[] => {
            const href = $(anchor).attr("href") ?? "";
            const title = decodeURIComponent(href.slice(WIKI_LINK.length).split("#")[0]).replaceAll(
                "_",
                " "
            );
            return title && !NON_ARTICLE_TITLE.test(title)
                ? [{ text: cleanText($(anchor).text()), title }]
                : [];
        });
    return { links, text: cleanText(copy.text()) };
};

/** Notes may sit in a collapsed "Details" sub-table; its text is kept, its header dropped. */
const readNotes = ($: CheerioAPI, cell: Element): string | null => {
    const copy = $(cell).clone();
    copy.find(`${NOISE}, th`).remove();
    const text = cleanText(copy.text());
    return text || null;
};

/** Expands row and column spans so every row has one entry per column. */
const buildGrid = ($: CheerioAPI, table: Element): Element[][] => {
    const rows = $(table).find("> tbody > tr, > thead > tr, > tr").toArray();
    const carried: ({ cell: Element; remaining: number } | undefined)[] = [];
    const grid: Element[][] = [];

    for (const row of rows) {
        const cells = $(row).children("td, th").toArray();
        const line: Element[] = [];
        let column = 0;
        let next = 0;
        const hasCarried = () =>
            carried.slice(column).some((entry) => entry && entry.remaining > 0);

        while (next < cells.length || hasCarried()) {
            const carry = carried[column];
            if (carry && carry.remaining > 0) {
                line[column] = carry.cell;
                carry.remaining -= 1;
                column += 1;
                continue;
            }
            const cell = cells[next];
            next += 1;
            if (!cell) {
                column += 1;
                continue;
            }
            const colspan = Number($(cell).attr("colspan")) || 1;
            const rowspan = Number($(cell).attr("rowspan")) || 1;
            for (let offset = 0; offset < colspan; offset += 1) {
                line[column] = cell;
                carried[column] = rowspan > 1 ? { cell, remaining: rowspan - 1 } : undefined;
                column += 1;
            }
        }
        grid.push(line);
    }
    return grid;
};

const mapColumns = (headers: readonly string[]): Partial<Record<ColumnKey, number>> => {
    const columns: Partial<Record<ColumnKey, number>> = {};
    const claimed = new Set<number>();
    for (const [key, pattern] of COLUMN_PATTERNS) {
        const index = headers.findIndex(
            (header, position) => !claimed.has(position) && pattern.test(header)
        );
        if (index >= 0) {
            columns[key] = index;
            claimed.add(index);
        }
    }
    return columns;
};

interface SectionContext {
    hint: TravelStatusHint;
    year: number | null;
}

/** A heading names a year only if it mentions exactly one ("2016", not "2014–2019"). */
const singleYear = (text: string): number | null => {
    const years = new Set(text.match(YEAR) ?? []);
    return years.size === 1 ? Number([...years][0]) : null;
};

const contextFrom = (headings: readonly string[]): SectionContext => {
    let year: number | null = null;
    let hint: TravelStatusHint = null;
    // Skipped heading levels leave holes in the list.
    for (const heading of headings.filter(Boolean)) {
        year = singleYear(heading) ?? year;
        if (CANCELLED_HEADING.test(heading)) {
            hint = "cancelled";
        } else if (FUTURE_HEADING.test(heading) && hint !== "cancelled") {
            hint = "planned";
        }
    }
    return { hint, year };
};

const isHeaderRow = (line: readonly Element[]): boolean =>
    line.length > 1 && line.every((cell) => cell.tagName === "th");

const readTable = (
    $: CheerioAPI,
    table: Element,
    section: SectionContext
): { headers: string[]; rows: TripRow[] } => {
    const grid = buildGrid($, table);
    const headerIndex = grid.findIndex(isHeaderRow);
    const headers =
        headerIndex >= 0
            ? grid[headerIndex].map((cell) => cleanText($(cell).text()).toLowerCase())
            : [];
    const columns = mapColumns(headers);
    const hasPlace = columns.country !== undefined || columns.cities !== undefined;
    if (columns.date === undefined || !hasPlace) {
        return { headers, rows: [] };
    }

    const caption = cleanText($(table).children("caption").text());
    const context = caption ? contextFrom([caption]) : { hint: null, year: null };
    const cellAt = (line: readonly Element[], key: ColumnKey): Element | undefined => {
        const index = columns[key];
        return index === undefined ? undefined : line[index];
    };

    const rows = grid.slice(headerIndex + 1).flatMap((line): TripRow[] => {
        const dateCell = cellAt(line, "date");
        if (!dateCell || line.every((cell) => cell.tagName === "th")) {
            return [];
        }
        const date = readCell($, dateCell).text;
        if (!date) {
            return [];
        }
        const country = cellAt(line, "country");
        const cities = cellAt(line, "cities");
        const purpose = cellAt(line, "purpose");
        const notes = cellAt(line, "notes");
        return [
            {
                cities: cities ? readCell($, cities) : null,
                contextYear: context.year ?? section.year,
                country: country ? readCell($, country) : null,
                date,
                notes: notes ? readNotes($, notes) : null,
                purpose: purpose ? readCell($, purpose) : null,
                sectionHint: context.hint ?? section.hint,
            },
        ];
    });
    return { headers, rows };
};

const HEADING_LEVEL: Readonly<Record<string, number>> = { h2: 0, h3: 1, h4: 2 };

/**
 * Reads every trip table on a page.
 *
 * @param html - Rendered article HTML.
 * @returns Rows from tables with recognisable columns, and the headers of skipped tables.
 */
export const parseTripTables = (html: string): ParsedTripPage => {
    const $ = load(html);
    const headings: string[] = [];
    const rows: TripRow[] = [];
    const skippedTables: string[] = [];

    for (const element of $("h2, h3, h4, table.wikitable").toArray()) {
        const level = HEADING_LEVEL[element.tagName];
        if (level !== undefined) {
            headings.length = level;
            headings[level] = cleanText($(element).text());
            continue;
        }
        if ($(element).parents("table").length > 0) {
            continue;
        }
        const table = readTable($, element, contextFrom(headings));
        if (table.rows.length > 0) {
            rows.push(...table.rows);
        } else if (table.headers.length > 0) {
            skippedTables.push(table.headers.join(" | "));
        }
    }
    return { rows, skippedTables };
};

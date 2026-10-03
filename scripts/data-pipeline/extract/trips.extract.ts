import type {
    GeneratedOfficial,
    GeneratedTrip,
} from "@/features/travel-explorer/data/generated-data.schema";
import type { IsoDate } from "@/features/travel-explorer/types/travel.types";
import { getCountryReference } from "@/lib/geo/country-reference";

import { PIPELINE_CONFIG } from "../config";
import { log } from "../lib/log";
import { cleanText, splitSentences } from "../lib/text";
import { fetchArticleHtml, wikipediaUrl } from "../sources/wikipedia";
import type { PipelineReport } from "../types";
import { buildPlaceResolver, type PlaceResolver } from "./places.resolve";
import { parseTripDates, type TripDates } from "./trip-dates.parse";
import { discoverTripPages, type TripPage } from "./trip-pages.discover";
import { parseTripTables, type TripRow } from "./trip-tables.parse";
import { classifyTripType, detectEventName } from "./trip-type.classify";

const CANCELLED = /\b(cancel+ed|postponed|called off)\b/i;
const NOTE_NOISE = /^(see also|main article|further information)\b/i;
const MAX_PURPOSE_LENGTH = 140;
const MAX_ENGAGEMENTS = 2;
const MIN_ENGAGEMENT_LENGTH = 12;
const MAX_ENGAGEMENT_LENGTH = 180;
const MAX_REPORTED_SKIPS = 15;
const YEAR_LENGTH = 4;

interface SkipReason {
    reason: string;
    text: string;
}

const shorten = (text: string, limit: number): string => {
    if (text.length <= limit) {
        return text;
    }
    const firstSentence = splitSentences(text)[0] ?? text;
    return firstSentence.length <= limit
        ? firstSentence
        : `${firstSentence.slice(0, limit - 1).trimEnd()}…`;
};

const noteSentences = (notes: string | null): string[] =>
    notes
        ? splitSentences(notes).filter(
              (sentence) => sentence.length >= MIN_ENGAGEMENT_LENGTH && !NOTE_NOISE.test(sentence)
          )
        : [];

interface RowContext {
    official: GeneratedOfficial;
    page: TripPage;
    resolver: PlaceResolver;
    today: IsoDate;
}

/**
 * Reads a row's dates. Rows under "Future trips" headings often omit the year ("22–23
 * October"); those take the next time that date comes round, counted from today.
 */
const datesOf = (row: TripRow, today: IsoDate): TripDates | null => {
    const dates = parseTripDates(row.date, row.contextYear);
    if (dates || row.contextYear !== null || row.sectionHint !== "planned") {
        return dates;
    }
    const year = Number(today.slice(0, YEAR_LENGTH));
    const thisYear = parseTripDates(row.date, year);
    return thisYear && thisYear.endDate >= today ? thisYear : parseTripDates(row.date, year + 1);
};

/**
 * Purpose and engagements of a row. Tables without a purpose column describe the trip in a
 * notes column instead, so its first sentence becomes the purpose.
 */
const describeRow = (row: TripRow): { engagements: string[]; purpose: string | null } => {
    const purpose = cleanText(row.purpose?.text ?? "");
    const notes = noteSentences(row.notes);
    const [lead, ...rest] = purpose ? [purpose, ...notes] : notes;
    return {
        engagements: rest
            .slice(0, MAX_ENGAGEMENTS)
            .map((sentence) => shorten(sentence, MAX_ENGAGEMENT_LENGTH)),
        purpose: lead ? shorten(lead, MAX_PURPOSE_LENGTH) : null,
    };
};

/** One row can name several countries (a regional tour); each becomes its own trip. */
const tripsFromRow = (
    row: TripRow,
    { official, page, resolver, today }: RowContext
): GeneratedTrip[] | SkipReason => {
    const dates = datesOf(row, today);
    if (!dates) {
        return { reason: "date not understood", text: row.date };
    }
    if (Number(dates.startDate.slice(0, 4)) < PIPELINE_CONFIG.sinceYear) {
        return [];
    }
    const destinations = resolver.destinationsOf(row, official.countryCode);
    if (destinations.length === 0) {
        return {
            reason: "destination not found",
            text: row.country?.text ?? row.cities?.text ?? "",
        };
    }

    const purposeText = cleanText(row.purpose?.text ?? "");
    const { engagements, purpose } = describeRow(row);
    const isCancelled =
        row.sectionHint === "cancelled" || CANCELLED.test(`${row.date} ${purposeText}`);
    const eventName = detectEventName(
        row.purpose?.links.map((link) => link.text) ?? [],
        purposeText
    );

    return destinations.map((destination) => ({
        datePrecision: dates.precision,
        destination,
        endDate: dates.endDate,
        engagements,
        eventName,
        id: `${official.id}--${dates.startDate}--${destination.countryCode}`,
        officialId: official.id,
        purpose:
            purpose ??
            `Visit to ${getCountryReference(destination.countryCode)?.name ?? destination.city}`,
        sources: [{ label: "Wikipedia", url: wikipediaUrl(page.title) }],
        startDate: dates.startDate,
        statusHint: isCancelled ? "cancelled" : row.sectionHint,
        type: classifyTripType(purposeText, row.notes),
    }));
};

/** Rows describing the same trip (one per city) merge into one record. */
const mergeTrip = (existing: GeneratedTrip, next: GeneratedTrip): GeneratedTrip => ({
    ...existing,
    endDate: next.endDate > existing.endDate ? next.endDate : existing.endDate,
    engagements: [...new Set([...existing.engagements, ...next.engagements])].slice(
        0,
        MAX_ENGAGEMENTS
    ),
});

/**
 * Finds, reads and converts every trip-list page.
 *
 * @param officials - All officials (pages are only searched for leaders and foreign ministers).
 * @param report - Run report; skipped rows are recorded per page.
 * @param today - Run date, for future trips listed without a year.
 * @returns Trips sorted by id.
 */
export const extractTrips = async (
    officials: readonly GeneratedOfficial[],
    report: PipelineReport,
    today: IsoDate
): Promise<GeneratedTrip[]> => {
    const pages = await discoverTripPages(officials);
    log.info(`Found ${pages.length} trip-list pages`);

    const parsed: { page: TripPage; rows: TripRow[]; skippedTables: string[] }[] = [];
    const articles = await Promise.all(pages.map((page) => fetchArticleHtml(page.title)));
    for (const [index, page] of pages.entries()) {
        const article = articles[index];
        if (article) {
            parsed.push({ page, ...parseTripTables(article.html) });
        } else {
            log.warn(`Missing page: ${page.title}`);
        }
    }

    const links = parsed.flatMap(({ rows }) =>
        rows.flatMap((row) => [...(row.country?.links ?? []), ...(row.cities?.links ?? [])])
    );
    log.info(`Locating ${new Set(links.map((link) => link.title)).size} linked places`);
    const resolver = await buildPlaceResolver(links);
    const officialById = new Map(officials.map((official) => [official.id, official]));

    const trips = new Map<string, GeneratedTrip>();
    for (const { page, rows, skippedTables } of parsed) {
        const official = officialById.get(page.officialId);
        if (!official) {
            continue;
        }
        const skipped: SkipReason[] = skippedTables.map((headers) => ({
            reason: "table without date/place columns",
            text: headers,
        }));
        let records = 0;
        for (const row of rows) {
            const result = tripsFromRow(row, { official, page, resolver, today });
            if (!Array.isArray(result)) {
                skipped.push(result);
                continue;
            }
            for (const trip of result) {
                const existing = trips.get(trip.id);
                trips.set(trip.id, existing ? mergeTrip(existing, trip) : trip);
                records += 1;
            }
        }
        report.tripPages.push({
            official: official.fullName,
            records,
            rowsSkipped: skipped.slice(0, MAX_REPORTED_SKIPS),
            title: page.title,
        });
    }

    return [...trips.values()].sort((a, b) => a.id.localeCompare(b.id));
};

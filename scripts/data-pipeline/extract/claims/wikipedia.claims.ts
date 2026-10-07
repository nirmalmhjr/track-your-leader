import type { IsoDate, Place, RoleCategory } from "@/types/travel.types";

import { log } from "../../lib/log";
import { cleanText, splitSentences } from "../../lib/text";
import {
    fetchArticleHtml,
    fetchWikidataIds,
    WIKI_LANGUAGES,
    type WikiLanguage,
    wikipediaUrl,
} from "../../sources/wikipedia";
import type {
    OfficialDraft,
    PipelineReport,
    SkippedRow,
    TravellerHint,
    TripClaim,
} from "../../types";
import { buildPlaceResolver, type PlaceIndex, type PlaceResolver } from "../places.resolve";
import { classifyTitle } from "../roles";
import { parseTripDates, type TripDates } from "../trip-dates.parse";
import { discoverTripPages, type TripPage } from "../trip-pages.discover";
import { parseTripTables, type TripRow } from "../trip-tables.parse";
import { classifyTripType, detectEventName } from "../trip-type.classify";
import { officeOf } from "../visitor-titles";

/**
 * Wikipedia trip-list pages: "List of international … trips made by …" for the best-known
 * leaders and foreign ministers, and monarchs' "official overseas trips" and "state visits"
 * pages. Pages of state visits a monarch received become trips of each visiting head of state.
 * CC BY-SA.
 */

/** Pages about state visits only; their rows default to state visits, received ones included. */
const STATE_VISIT_PAGE =
    /^(?:List of state visits|Liste des visites d'État|Lijst van staatsbezoeken|Liste over statsbesøk|Lista över statsbesök)\b/i;
const CANCELLED = /\b(cancel+ed|postponed|called off)\b/i;
const NOTE_NOISE = /^(see also|main article|further information)\b/i;
const MAX_PURPOSE_LENGTH = 140;
const MAX_ENGAGEMENTS = 2;
const MIN_ENGAGEMENT_LENGTH = 12;
const MAX_ENGAGEMENT_LENGTH = 180;
const MAX_REPORTED_SKIPS = 15;
const YEAR_LENGTH = 4;

/** Roles whose trips Wikipedia tends to list. */
const travelsOften = (draft: OfficialDraft): boolean =>
    draft.positions.some(
        (position) =>
            position.portfolio === "foreign_affairs" ||
            position.categories.some((category) =>
                ["head_of_state", "head_of_government", "deputy_leader"].includes(category)
            )
    );

/**
 * Shortens text to its first sentence, then to a character limit.
 *
 * @param text - Text to shorten.
 * @param limit - Maximum length.
 * @returns The shortened text.
 */
export const shorten = (text: string, limit: number): string => {
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

interface RowContext {
    draft: OfficialDraft;
    /** Known officials by Wikidata id, for the country of a visitor no column names. */
    draftById: ReadonlyMap<string, OfficialDraft>;
    page: TripPage;
    resolver: PlaceResolver;
    today: IsoDate;
    /** Wikidata ids of the visitors linked in lists of visits received, by article title. */
    visitorIds: ReadonlyMap<string, string>;
}

/** Who travelled and where to, as read from one row. */
interface RowTrip {
    destination: Place;
    traveller: TravellerHint;
}

/** The page owner's own trips: one per destination country (a regional tour lists several). */
const ownTrips = (row: TripRow, { draft, resolver }: RowContext): RowTrip[] =>
    resolver.destinationsOf(row, draft.countryCode).map((destination) => ({
        destination,
        traveller: {
            categories: [],
            countryCode: draft.countryCode,
            familyName: null,
            name: draft.name,
            portfolio: null,
            title: null,
            wikidataId: draft.wikidataId,
        },
    }));

/** Offices a visitor's listed title can give; other titles leave the role to the name. */
const VISITOR_ROLES: ReadonlySet<RoleCategory> = new Set([
    "head_of_state",
    "head_of_government",
    "deputy_leader",
    "minister",
]);

/** The visitor a row names, with their office from the title column ("Prime Minister"). */
const namedVisitor = (
    row: TripRow,
    countryCode: TravellerHint["countryCode"],
    wikidataId: string | null
): TravellerHint | null => {
    const name = cleanText(row.visitor?.text ?? "");
    if (!name) {
        return null;
    }
    const role = row.visitorTitle ? classifyTitle(row.visitorTitle) : null;
    // Without a title column the name may carry the office ("Prime Minister Matteo Renzi");
    // otherwise state visits are paid by heads of state.
    const categories = role
        ? role.categories.filter((category) => VISITOR_ROLES.has(category))
        : (officeOf(name, countryCode)?.categories ?? (["head_of_state"] as RoleCategory[]));
    return {
        categories,
        countryCode,
        familyName: null,
        name,
        portfolio: role?.portfolio ?? null,
        title: row.visitorTitle,
        wikidataId,
    };
};

/**
 * Visits the page owner's country hosted: one trip per visiting country. The visitor is the one
 * the row names, when it does; otherwise whoever was the country's head of state on that date
 * (state visits are paid by heads of state).
 */
const receivedTrips = (
    row: TripRow,
    { draft, draftById, resolver, visitorIds }: RowContext
): RowTrip[] => {
    // Without a country column, the visitor's cell names the country by its flag.
    const { destination, visitors: listed } = resolver.visitsTo(
        { cities: row.cities, country: row.country ?? row.visitor },
        draft.countryCode
    );
    if (!destination) {
        return [];
    }
    // The visitor is the linked person who is a known official (the cell may also link the flag
    // and the office); their record gives the country when nothing else does.
    const linkedId = (row.visitor?.links ?? [])
        .map((link) => visitorIds.get(link.title))
        .find((id) => id !== undefined && draftById.has(id));
    const linkedCountry = linkedId ? draftById.get(linkedId)?.countryCode : undefined;
    const visitors =
        listed.length === 0 && linkedCountry && linkedCountry !== draft.countryCode
            ? [linkedCountry]
            : listed;
    const named =
        visitors.length === 1 && visitors[0]
            ? namedVisitor(row, visitors[0], linkedId ?? null)
            : null;
    if (named) {
        return [{ destination, traveller: named }];
    }
    return visitors.map((countryCode) => ({
        destination,
        traveller: {
            categories: ["head_of_state"],
            countryCode,
            familyName: null,
            name: null,
            portfolio: null,
            title: "Head of state",
            wikidataId: null,
        },
    }));
};

/** One row can name several countries (a regional tour); each becomes its own claim. */
const claimsFromRow = (row: TripRow, context: RowContext): TripClaim[] | SkippedRow => {
    const { page, today } = context;
    const isStateVisitPage = STATE_VISIT_PAGE.test(page.title);
    const isReceived = page.direction === "received" || row.received;
    if (isReceived && !isStateVisitPage && !row.visitor) {
        // Visits hosted by a president or minister may be by heads of government too, so the
        // visitor can't be inferred from the office alone.
        return { reason: "hosted visit on a trip page", text: row.country?.text ?? row.date };
    }
    const dates = datesOf(row, today);
    if (!dates) {
        return { reason: "date not understood", text: row.date };
    }
    const trips = isReceived ? receivedTrips(row, context) : ownTrips(row, context);
    if (trips.length === 0) {
        return {
            reason: isReceived ? "visiting country not found" : "destination not found",
            text: row.country?.text ?? row.cities?.text ?? "",
        };
    }

    const purposeText = cleanText(row.purpose?.text ?? "");
    // The app is in English: other Wikipedias give the trip's facts (dates, places, type), not
    // their wording.
    const isEnglish = page.language === "en";
    const { engagements, purpose } = isEnglish
        ? describeRow(row)
        : { engagements: [], purpose: null };
    const isCancelled =
        row.sectionHint === "cancelled" || CANCELLED.test(`${row.date} ${purposeText}`);
    const classified = classifyTripType(purposeText, row.notes);

    return trips.map(({ destination, traveller }) => ({
        datePrecision: dates.precision,
        destination,
        endDate: dates.endDate,
        engagements,
        eventName: isEnglish
            ? detectEventName(row.purpose?.links.map((link) => link.text) ?? [], purposeText)
            : null,
        purpose,
        source: "wikipedia",
        sourceRef: { label: "Wikipedia", url: wikipediaUrl(page.title, page.language) },
        startDate: dates.startDate,
        statusHint: isCancelled ? "cancelled" : row.sectionHint,
        traveller,
        type: classified === "other" && isStateVisitPage ? "state_visit" : classified,
    }));
};

/**
 * Visitors named in lists of visits received, identified by the article their name links to.
 *
 * @param parsed - Parsed pages.
 * @returns Wikidata id per linked article title, per Wikipedia.
 */
const resolveVisitors = async (
    parsed: readonly { page: TripPage; rows: TripRow[] }[]
): Promise<Map<WikiLanguage, Map<string, string>>> => {
    const visitorIds = new Map<WikiLanguage, Map<string, string>>();
    for (const language of WIKI_LANGUAGES) {
        const titles = parsed
            .filter(({ page }) => page.language === language)
            .flatMap(({ page, rows }) =>
                rows.flatMap((row) =>
                    page.direction === "received" || row.received ? (row.visitor?.links ?? []) : []
                )
            )
            .map((link) => link.title);
        if (titles.length > 0) {
            // biome-ignore lint/performance/noAwaitInLoops: one Wikipedia at a time keeps the lookups gentle.
            visitorIds.set(language, await fetchWikidataIds(titles, language));
        }
    }
    return visitorIds;
};

interface WikipediaInput {
    drafts: readonly OfficialDraft[];
    places: PlaceIndex;
    report: PipelineReport;
    today: IsoDate;
    /** Each person's article on every Wikipedia read, by Wikidata id. */
    wikiTitles: ReadonlyMap<string, Partial<Record<WikiLanguage, string>>>;
}

/**
 * Finds, reads and converts every trip-list page of the given officials.
 *
 * @returns One claim per destination country of every readable row.
 */
export const extractWikipediaClaims = async ({
    drafts,
    places,
    report,
    today,
    wikiTitles,
}: WikipediaInput): Promise<TripClaim[]> => {
    const draftById = new Map(
        drafts.flatMap((draft) => (draft.wikidataId ? [[draft.wikidataId, draft] as const] : []))
    );
    const pages = await discoverTripPages(
        drafts.flatMap((draft) => {
            const articles = draft.wikidataId ? wikiTitles.get(draft.wikidataId) : undefined;
            return articles && draft.wikidataId && travelsOften(draft)
                ? [{ articles, key: draft.wikidataId }]
                : [];
        })
    );
    for (const language of WIKI_LANGUAGES) {
        const count = pages.filter((page) => page.language === language).length;
        log.info(`Found ${count} trip-list pages on ${language}.wikipedia.org`);
    }

    const parsed: { page: TripPage; rows: TripRow[]; skippedTables: string[] }[] = [];
    const articles = await Promise.all(
        pages.map((page) => fetchArticleHtml(page.title, page.language))
    );
    for (const [index, page] of pages.entries()) {
        const article = articles[index];
        if (article) {
            parsed.push({ page, ...parseTripTables(article.html) });
        } else {
            log.warn(`Missing page: ${page.title}`);
        }
    }

    // Links point into the page's own Wikipedia, so places are looked up per language.
    const resolvers = new Map<WikiLanguage, PlaceResolver>();
    for (const language of WIKI_LANGUAGES) {
        const links = parsed
            .filter(({ page }) => page.language === language)
            .flatMap(({ rows }) =>
                rows.flatMap((row) => [...(row.country?.links ?? []), ...(row.cities?.links ?? [])])
            );
        log.info(
            `Locating ${new Set(links.map((link) => link.title)).size} linked places (${language})`
        );
        // biome-ignore lint/performance/noAwaitInLoops: one Wikipedia at a time keeps the lookups gentle.
        resolvers.set(language, await buildPlaceResolver(links, places, language));
    }

    const visitorIds = await resolveVisitors(parsed);

    const claims: TripClaim[] = [];
    for (const { page, rows, skippedTables } of parsed) {
        const draft = draftById.get(page.key);
        const resolver = resolvers.get(page.language);
        if (!(draft && resolver)) {
            continue;
        }
        const skipped: SkippedRow[] = skippedTables.map((headers) => ({
            reason: "table without date/place columns",
            text: headers,
        }));
        let records = 0;
        for (const row of rows) {
            const result = claimsFromRow(row, {
                draft,
                draftById,
                page,
                resolver,
                today,
                visitorIds: visitorIds.get(page.language) ?? new Map(),
            });
            if (Array.isArray(result)) {
                claims.push(...result);
                records += result.length;
            } else {
                skipped.push(result);
            }
        }
        report.tripPages.push({
            official: draft.name,
            records,
            rowsSkipped: skipped.slice(0, MAX_REPORTED_SKIPS),
            title: page.language === "en" ? page.title : `${page.language}:${page.title}`,
        });
    }
    return claims;
};

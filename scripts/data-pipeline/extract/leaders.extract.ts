import type { IsoDate } from "@/features/travel-explorer/types/travel.types";
import type { CountryCode } from "@/types/geo.types";

import { COUNTRY_SOURCES, PIPELINE_CONFIG } from "../config";
import { groupBy } from "../lib/collections";
import { addDaysIso } from "../lib/dates";
import { capitalize } from "../lib/text";
import { entityId, fetchEntities, HUMAN, runSparql, wikidataUrl } from "../sources/wikidata";
import type { CountryContext, OfficeTerm, OfficialDraft, PositionDraft } from "../types";
import { classifyTitle } from "./roles";

/** `nature of statement: acting` — caretakers are not recorded as office holders. */
const ACTING = "Q4676846";
const DATE_LENGTH = 10;

const sparqlString = (value: string): string => JSON.stringify(value);

/**
 * Looks up each tracked country's Wikidata item and the offices of its head of state and
 * head of government.
 *
 * @param codes - ISO alpha-3 codes of tracked countries.
 * @returns Context per country code.
 */
export const fetchCountryContexts = async (
    codes: readonly CountryCode[]
): Promise<Map<CountryCode, CountryContext>> => {
    const rows = await runSparql(`
        SELECT ?iso ?country ?hos ?hog WHERE {
            VALUES ?iso { ${codes.map(sparqlString).join(" ")} }
            ?country wdt:P298 ?iso .
            OPTIONAL { ?country wdt:P1906 ?hos }
            OPTIONAL { ?country wdt:P1313 ?hog }
        } ORDER BY ?iso ?hos ?hog`);

    const contexts = new Map<CountryCode, CountryContext>();
    for (const row of rows) {
        const code = row.iso;
        const wikidataId = entityId(row.country);
        if (!(code && wikidataId) || contexts.has(code)) {
            continue;
        }
        contexts.set(code, {
            code,
            headOfGovernmentOffice: entityId(row.hog),
            headOfStateOffice: COUNTRY_SOURCES[code]?.includeHeadOfState ? entityId(row.hos) : null,
            wikidataId,
        });
    }
    return contexts;
};

/**
 * Resolves office items from their English labels (used for the US cabinet).
 *
 * @param labels - Exact English labels.
 * @returns Office item ids.
 */
export const fetchOfficesByLabel = async (labels: readonly string[]): Promise<string[]> => {
    if (labels.length === 0) {
        return [];
    }
    const rows = await runSparql(`
        SELECT DISTINCT ?office WHERE {
            VALUES ?label { ${labels.map((label) => `${sparqlString(label)}@en`).join(" ")} }
            ?office rdfs:label ?label .
            FILTER EXISTS { ?statement ps:P39 ?office }
        }`);
    return rows.flatMap((row) => entityId(row.office) ?? []);
};

/**
 * Merges repeated or overlapping terms of one person, then closes open-ended terms that a later
 * holder replaced (Wikidata often lacks the end date of a predecessor).
 *
 * @param terms - Raw terms of a single office.
 * @returns Clean, chronological terms.
 */
export const normalizeTerms = (terms: readonly OfficeTerm[]): OfficeTerm[] => {
    const sorted = [...terms].sort(
        (a, b) => a.startDate.localeCompare(b.startDate) || a.personId.localeCompare(b.personId)
    );
    const merged: OfficeTerm[] = [];
    for (const term of sorted) {
        const previous = merged.findLast((candidate) => candidate.personId === term.personId);
        const continues =
            previous &&
            (previous.endDate === null || term.startDate <= addDaysIso(previous.endDate, 1));
        if (previous && continues) {
            previous.endDate =
                previous.endDate === null || term.endDate === null
                    ? null
                    : ([previous.endDate, term.endDate].sort().at(-1) ?? null);
        } else {
            merged.push({ ...term });
        }
    }

    return merged.map((term) => {
        if (term.endDate !== null) {
            return term;
        }
        const successor = merged.find(
            (candidate) =>
                candidate.personId !== term.personId && candidate.startDate > term.startDate
        );
        return successor ? { ...term, endDate: successor.startDate } : term;
    });
};

/**
 * Fetches every term held in the given offices that was still running in the tracked period.
 *
 * @param officeIds - Office items.
 * @returns Normalised terms, per office.
 */
export const fetchOfficeTerms = async (officeIds: readonly string[]): Promise<OfficeTerm[]> => {
    if (officeIds.length === 0) {
        return [];
    }
    const since = `${PIPELINE_CONFIG.sinceYear}-01-01`;
    const rows = await runSparql(`
        SELECT ?office ?person ?start ?end WHERE {
            VALUES ?office { ${officeIds.map((id) => `wd:${id}`).join(" ")} }
            ?statement ps:P39 ?office .
            ?person p:P39 ?statement ; wdt:P31 wd:${HUMAN} .
            ?statement wikibase:rank ?rank ; pq:P580 ?start .
            FILTER(?rank != wikibase:DeprecatedRank)
            OPTIONAL { ?statement pq:P582 ?end }
            FILTER NOT EXISTS { ?statement pq:P5102 wd:${ACTING} }
        }`);

    const terms = rows.flatMap((row): OfficeTerm[] => {
        const officeId = entityId(row.office);
        const personId = entityId(row.person);
        const startDate = row.start?.slice(0, DATE_LENGTH);
        return officeId && personId && startDate
            ? [{ endDate: row.end?.slice(0, DATE_LENGTH) ?? null, officeId, personId, startDate }]
            : [];
    });

    return [...groupBy(terms, (term) => term.officeId).values()]
        .flatMap(normalizeTerms)
        .filter((term) => term.endDate === null || term.endDate >= since);
};

const positionFromTerm = (
    term: OfficeTerm,
    title: string,
    context: CountryContext
): PositionDraft => {
    const isHeadOfState = term.officeId === context.headOfStateOffice;
    const isHeadOfGovernment = term.officeId === context.headOfGovernmentOffice;
    const role = classifyTitle(title);
    const categories: PositionDraft["categories"] = [];
    if (isHeadOfState) {
        categories.push("head_of_state");
    }
    if (isHeadOfGovernment) {
        categories.push("head_of_government");
    }

    return {
        categories: categories.length > 0 ? categories : role.categories,
        endDate: term.endDate,
        ministry: categories.length > 0 ? null : role.ministry,
        portfolio: categories.length > 0 ? null : role.portfolio,
        startDate: term.startDate,
        title,
    };
};

interface LeaderSources {
    contexts: ReadonlyMap<CountryCode, CountryContext>;
    /** Extra offices per country (e.g. the US cabinet), already resolved to item ids. */
    extraOffices: ReadonlyMap<CountryCode, readonly string[]>;
}

/**
 * Builds drafts for everyone who held a leader office (or an extra configured office) in the
 * tracked period, with one position per continuous term.
 *
 * @returns Drafts keyed by Wikidata id.
 */
export const extractLeaders = async ({
    contexts,
    extraOffices,
}: LeaderSources): Promise<Map<string, OfficialDraft>> => {
    const countryByOffice = new Map<string, CountryContext>();
    for (const context of contexts.values()) {
        const offices = [
            context.headOfStateOffice,
            context.headOfGovernmentOffice,
            ...(extraOffices.get(context.code) ?? []),
        ];
        for (const office of offices) {
            if (office) {
                countryByOffice.set(office, context);
            }
        }
    }

    const terms = await fetchOfficeTerms([...countryByOffice.keys()]);
    const people = await fetchEntities(
        [...new Set([...countryByOffice.keys(), ...terms.map((term) => term.personId)])],
        ["labels"]
    );

    const drafts = new Map<string, OfficialDraft>();
    for (const term of terms) {
        const context = countryByOffice.get(term.officeId);
        const officeLabel = people.get(term.officeId)?.label;
        if (!(context && officeLabel)) {
            continue;
        }
        const draft = drafts.get(term.personId) ?? {
            countryCode: context.code,
            name: people.get(term.personId)?.label ?? term.personId,
            positions: [],
            sources: [{ label: "Wikidata", url: wikidataUrl(term.personId) }],
            wikidataId: term.personId,
        };
        draft.positions.push(positionFromTerm(term, capitalize(officeLabel), context));
        drafts.set(term.personId, draft);
    }
    return drafts;
};

/**
 * Current holders of the leader offices, used to spot outdated cabinet lists.
 *
 * @param drafts - Leader drafts.
 * @returns Per country, the names and start dates of current heads of state and government.
 */
export const currentLeaders = (
    drafts: ReadonlyMap<string, OfficialDraft>
): Map<CountryCode, { name: string; startDate: IsoDate | null }[]> => {
    const leaders = new Map<CountryCode, { name: string; startDate: IsoDate | null }[]>();
    for (const draft of drafts.values()) {
        for (const position of draft.positions) {
            const isLeader =
                position.categories.includes("head_of_state") ||
                position.categories.includes("head_of_government");
            if (isLeader && position.endDate === null) {
                const list = leaders.get(draft.countryCode) ?? [];
                list.push({ name: draft.name, startDate: position.startDate });
                leaders.set(draft.countryCode, list);
            }
        }
    }
    return leaders;
};

import type { CountryCode } from "@/types/geo.types";
import type { IsoDate, Portfolio, RoleCategory } from "@/types/travel.types";

import { countrySourceFor } from "../config";
import { chunk, groupBy } from "../lib/collections";
import { addDaysIso, isoFromParts, isValidDay } from "../lib/dates";
import { capitalize } from "../lib/text";
import {
    entityId,
    fetchEntities,
    HUMAN,
    runSparql,
    type SparqlRow,
    wikidataUrl,
} from "../sources/wikidata";
import type { CountryContext, OfficeTerm, OfficialDraft, PositionDraft } from "../types";
import { LEADER_TERM_OVERRIDES } from "./leaders.overrides";
import { ITEMS_WITHOUT_ISO_CODE } from "./places.resolve";
import { classifyTitle } from "./roles";

/** `nature of statement: acting` — caretakers are not recorded as office holders. */
const ACTING = "Q4676846";
const DATE_LENGTH = 10;
/** Offices per terms query; larger lists risk the query service's timeout. */
const OFFICE_BATCH_SIZE = 100;

/**
 * Wikidata classes of the ministerial offices collected for every country, beyond the heads
 * of state and government: the people who travel most on a government's behalf.
 */
const MINISTER_OFFICE_CLASSES: Readonly<Record<string, OfficeRole>> = {
    Q42178: { categories: ["deputy_leader"], portfolio: null }, // vice president
    Q877955: { categories: ["deputy_leader"], portfolio: null }, // deputy prime minister
    Q2518691: { categories: ["minister"], portfolio: "defence" }, // defence minister
    Q7330070: { categories: ["minister"], portfolio: "foreign_affairs" }, // foreign minister
    Q7614320: { categories: ["minister"], portfolio: "finance" }, // finance minister
};

/** Role of an office known from its class, since office labels are worded too freely to parse. */
export interface OfficeRole {
    categories: RoleCategory[];
    portfolio: Portfolio | null;
}

const sparqlString = (value: string): string => JSON.stringify(value);
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Reads a SPARQL date, rejecting values that aren't ordinary calendar dates (Wikidata also
 * holds BCE years, five-digit years and placeholder days).
 */
const calendarDate = (value: string | undefined): IsoDate | null => {
    const match = value?.slice(0, DATE_LENGTH).match(ISO_DATE);
    if (!match) {
        return null;
    }
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    return isValidDay(year, month, day) ? isoFromParts(year, month, day) : null;
};

/**
 * Binds `?state` to the states `?country` alone succeeded: the Kingdom of Nepal for Nepal, but
 * not the Soviet Union, which fifteen states succeeded.
 */
const SOLE_PREDECESSOR_PATTERN = `?state wdt:P1366 ?country .
            FILTER NOT EXISTS { ?state wdt:P1366 ?other . FILTER(?other != ?country) }`;

/** Historical country, sovereign state: rules out princely states and other subdivisions. */
const SOVEREIGN_STATE_CLASSES = "wd:Q3024240 wd:Q3624078";
/** Predecessor states per offices query; India alone has hundreds of princely states. */
const STATE_BATCH_SIZE = 50;

/**
 * Adds the leader offices of the states each country alone succeeded, such as "King of Nepal"
 * from the Kingdom of Nepal. Only sovereign predecessors count, and only offices that belong to
 * them or to the country: the Dominion of India names the generic "prime minister" and the
 * Raj's Governor-General, neither of which is India's own office.
 */
const withFormerLeaderOffices = async (
    contexts: Map<CountryCode, CountryContext>
): Promise<Map<CountryCode, CountryContext>> => {
    const countryItems = new Set([...contexts.values()].map((context) => context.wikidataId));
    const predecessors = [...(await fetchStateItems(contexts))].filter(
        ([state]) => !countryItems.has(state)
    );
    const rows = (
        await Promise.all(
            chunk(predecessors.map(([state]) => state).sort(), STATE_BATCH_SIZE).map((batch) =>
                runSparql(`
                    SELECT ?state ?hos ?hosPlace ?hog ?hogPlace WHERE {
                        VALUES ?state { ${batch.map((id) => `wd:${id}`).join(" ")} }
                        FILTER EXISTS { ?state wdt:P31 ?type .
                            VALUES ?type { ${SOVEREIGN_STATE_CLASSES} } }
                        OPTIONAL { ?state wdt:P1906 ?hos . ?hos wdt:P1001 ?hosPlace }
                        OPTIONAL { ?state wdt:P1313 ?hog . ?hog wdt:P1001 ?hogPlace }
                    }`)
            )
        )
    ).flat();

    const codeOfState = new Map(predecessors);
    const former = new Map<CountryCode, { hog: Set<string>; hos: Set<string> }>();
    for (const row of rows) {
        const state = entityId(row.state) ?? "";
        const context = contexts.get(codeOfState.get(state) ?? "");
        if (!context) {
            continue;
        }
        const belongsHere = (place: string | undefined): boolean =>
            [state, context.wikidataId].includes(entityId(place) ?? "");
        const offices = former.get(context.code) ?? { hog: new Set(), hos: new Set() };
        const hos = entityId(row.hos);
        const hog = entityId(row.hog);
        if (hos && belongsHere(row.hosPlace) && countrySourceFor(context.code).includeHeadOfState) {
            offices.hos.add(hos);
        }
        if (hog && belongsHere(row.hogPlace)) {
            offices.hog.add(hog);
        }
        former.set(context.code, offices);
    }
    for (const [code, offices] of former) {
        const context = contexts.get(code);
        if (context) {
            const current = [context.headOfStateOffice, context.headOfGovernmentOffice];
            contexts.set(code, {
                ...context,
                formerHeadOfGovernmentOffices: [...offices.hog].filter(
                    (office) => !current.includes(office)
                ),
                formerHeadOfStateOffices: [...offices.hos].filter(
                    (office) => !current.includes(office)
                ),
            });
        }
    }
    return contexts;
};

/**
 * Looks up each tracked country's Wikidata item, the offices of its head of state and head of
 * government, and the leader offices of the states it alone succeeded ("King of Nepal").
 *
 * @param codes - ISO alpha-3 codes of tracked countries.
 * @returns Context per country code.
 */
export const fetchCountryContexts = async (
    codes: readonly CountryCode[]
): Promise<Map<CountryCode, CountryContext>> => {
    const rows = await runSparql(`
        SELECT ?iso ?country ?hos ?hog WHERE {
            {
                VALUES ?iso { ${codes.map(sparqlString).join(" ")} }
                ?country wdt:P298 ?iso .
            } UNION {
                VALUES (?country ?iso) { ${Object.entries(ITEMS_WITHOUT_ISO_CODE)
                    .filter(([code]) => codes.includes(code))
                    .map(([code, item]) => `(wd:${item} ${sparqlString(code)})`)
                    .join(" ")} }
            }
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
            formerHeadOfGovernmentOffices: [],
            formerHeadOfStateOffices: [],
            headOfGovernmentOffice: entityId(row.hog),
            headOfStateOffice: countrySourceFor(code).includeHeadOfState ? entityId(row.hos) : null,
            wikidataId,
        });
    }

    return withFormerLeaderOffices(contexts);
};

/**
 * The leader categories an office stands for in a country: head of state, head of government,
 * both (one office in presidential systems) or neither.
 *
 * @param officeId - Office item.
 * @param context - The country's leader offices, current and former.
 * @returns The categories, head of state first.
 */
export const leaderCategoriesOf = (
    officeId: string,
    context: CountryContext
): ("head_of_state" | "head_of_government")[] => {
    const categories: ("head_of_state" | "head_of_government")[] = [];
    if (
        officeId === context.headOfStateOffice ||
        context.formerHeadOfStateOffices.includes(officeId)
    ) {
        categories.push("head_of_state");
    }
    if (
        officeId === context.headOfGovernmentOffice ||
        context.formerHeadOfGovernmentOffices.includes(officeId)
    ) {
        categories.push("head_of_government");
    }
    return categories;
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
 * Finds each country's ministerial offices (foreign, finance and defence ministers, deputy
 * prime ministers, vice presidents) by their Wikidata class and jurisdiction.
 *
 * @param contexts - Country contexts.
 * @returns Office ids per country code, and each office's role.
 */
export const fetchMinisterOffices = async (
    contexts: ReadonlyMap<CountryCode, CountryContext>
): Promise<{ offices: Map<CountryCode, string[]>; roles: Map<string, OfficeRole> }> => {
    const codeByItem = new Map(
        [...contexts.values()].map((context) => [context.wikidataId, context.code])
    );
    const rows = await runSparql(`
        SELECT DISTINCT ?office ?class ?country WHERE {
            VALUES ?class { ${Object.keys(MINISTER_OFFICE_CLASSES)
                .map((id) => `wd:${id}`)
                .join(" ")} }
            ?office wdt:P279 ?class ; wdt:P1001 ?country .
        }`);

    const offices = new Map<CountryCode, string[]>();
    const roles = new Map<string, OfficeRole>();
    for (const row of rows) {
        const office = entityId(row.office);
        const code = codeByItem.get(entityId(row.country) ?? "");
        const role = MINISTER_OFFICE_CLASSES[entityId(row.class) ?? ""];
        if (office && code && role) {
            offices.set(code, [...new Set([...(offices.get(code) ?? []), office])]);
            roles.set(office, role);
        }
    }
    return { offices, roles };
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
 * Fetches every term held in the given offices that was still running in the period.
 *
 * @param officeIds - Office items.
 * @param sinceYear - Terms that ended before this year are left out.
 * @returns Normalised terms, per office.
 */
export const fetchOfficeTerms = async (
    officeIds: readonly string[],
    sinceYear: number
): Promise<OfficeTerm[]> => {
    const since = `${sinceYear}-01-01`;
    const batches = await Promise.all(
        chunk([...new Set(officeIds)].sort(), OFFICE_BATCH_SIZE).map((batch) =>
            runSparql(`
                SELECT ?office ?person ?start ?end WHERE {
                    VALUES ?office { ${batch.map((id) => `wd:${id}`).join(" ")} }
                    ?statement ps:P39 ?office .
                    ?person p:P39 ?statement ; wdt:P31 wd:${HUMAN} .
                    ?statement wikibase:rank ?rank ; pq:P580 ?start .
                    FILTER(?rank != wikibase:DeprecatedRank)
                    OPTIONAL { ?statement pq:P582 ?end }
                    FILTER NOT EXISTS { ?statement pq:P5102 wd:${ACTING} }
                }`)
        )
    );

    const terms = batches.flat().flatMap((row): OfficeTerm[] => {
        const officeId = entityId(row.office);
        const personId = entityId(row.person);
        const startDate = calendarDate(row.start);
        return officeId && personId && startDate
            ? [{ endDate: calendarDate(row.end), officeId, personId, startDate }]
            : [];
    });

    return [...groupBy(terms, (term) => term.officeId).values()]
        .flatMap(normalizeTerms)
        .filter((term) => term.endDate === null || term.endDate >= since);
};

const positionFromTerm = (
    term: OfficeTerm,
    title: string,
    context: CountryContext,
    officeRole: OfficeRole | undefined
): PositionDraft => {
    const classified = classifyTitle(title);
    const role = officeRole ? { ...classified, ...officeRole } : classified;
    const categories: PositionDraft["categories"] = leaderCategoriesOf(term.officeId, context);

    return {
        categories: categories.length > 0 ? categories : role.categories,
        countryCode: context.code,
        endDate: term.endDate,
        ministry: categories.length > 0 ? null : role.ministry,
        portfolio: categories.length > 0 ? null : role.portfolio,
        startDate: term.startDate,
        title,
    };
};

/** Countries per statements query. */
const STATEMENT_BATCH_SIZE = 10;
const LEADER_KINDS = {
    hog: { category: "head_of_government", property: "P6", title: "Head of government" },
    hos: { category: "head_of_state", property: "P35", title: "Head of state" },
} as const;
type LeaderKind = keyof typeof LEADER_KINDS;

/** A dated "head of state" or "head of government" statement on a country's own item. */
interface LeaderStatement extends OfficeTerm {
    code: CountryCode;
    /** From `LEADER_TERM_OVERRIDES`: a correction, added even where Wikidata has a term already. */
    isOverride?: boolean;
    kind: LeaderKind;
    /** Office title, when known; otherwise the generic "Head of state" or "Head of government". */
    title?: string;
}

/** Terms Wikidata lacks, from `LEADER_TERM_OVERRIDES`, for the countries being collected. */
const overrideStatements = (
    contexts: ReadonlyMap<CountryCode, CountryContext>
): LeaderStatement[] =>
    LEADER_TERM_OVERRIDES.flatMap((override): LeaderStatement[] => {
        const isTracked =
            contexts.has(override.code) &&
            (override.kind === "hog" || countrySourceFor(override.code).includeHeadOfState);
        return isTracked
            ? [
                  {
                      code: override.code,
                      endDate: override.endDate,
                      isOverride: true,
                      kind: override.kind,
                      officeId: `${override.kind}:${override.code}`,
                      personId: override.personId,
                      startDate: override.startDate,
                      title: override.title,
                  },
              ]
            : [];
    });

/**
 * Each country's item, plus predecessor states that it alone succeeded (the Kingdom of Nepal
 * for Nepal; not the Soviet Union, which fifteen states succeeded).
 */
const fetchStateItems = async (
    contexts: ReadonlyMap<CountryCode, CountryContext>
): Promise<Map<string, CountryCode>> => {
    const codeByCountry = new Map(
        [...contexts.values()].map((context) => [context.wikidataId, context.code])
    );
    const states = new Map(codeByCountry);
    const rows = await runSparql(`
        SELECT ?country ?state WHERE {
            VALUES ?country { ${[...codeByCountry.keys()].map((id) => `wd:${id}`).join(" ")} }
            ${SOLE_PREDECESSOR_PATTERN}
        }`);
    for (const row of rows) {
        const code = codeByCountry.get(entityId(row.country) ?? "");
        const state = entityId(row.state);
        if (code && state && !states.has(state)) {
            states.set(state, code);
        }
    }
    return states;
};

/**
 * Leaders recorded on the countries' own items (P35 head of state, P6 head of government) with
 * a start date. Wikidata models some leader offices too loosely to find by class, such as
 * "Monarch of Afghanistan" with no country, so these statements fill the gaps.
 *
 * @param contexts - Country contexts.
 * @param sinceYear - Terms that ended before this year are left out.
 * @returns Normalised terms per country and kind.
 */
export const fetchLeaderStatements = async (
    contexts: ReadonlyMap<CountryCode, CountryContext>,
    sinceYear: number
): Promise<LeaderStatement[]> => {
    const since = `${sinceYear}-01-01`;
    const states = await fetchStateItems(contexts);
    const items = chunk([...states.keys()].sort(), STATEMENT_BATCH_SIZE);
    // One property per query keeps each one well inside the query service's time limit.
    const batches = await Promise.all(
        (Object.keys(LEADER_KINDS) as LeaderKind[]).flatMap((kind) =>
            items.map(async (batch) =>
                (
                    await runSparql(`
                        SELECT ?state ?person ?start ?end WHERE {
                            VALUES ?state { ${batch.map((id) => `wd:${id}`).join(" ")} }
                            ?state p:${LEADER_KINDS[kind].property} ?statement .
                            ?statement ps:${LEADER_KINDS[kind].property} ?person ;
                                pq:P580 ?start ; wikibase:rank ?rank .
                            FILTER(?rank != wikibase:DeprecatedRank)
                            ?person wdt:P31 wd:${HUMAN} .
                            OPTIONAL { ?statement pq:P582 ?end }
                        }`)
                ).map((row): SparqlRow & { kind: LeaderKind } => ({ ...row, kind }))
            )
        )
    );
    const statements = batches.flat().flatMap((row): LeaderStatement[] => {
        const code = states.get(entityId(row.state) ?? "");
        const personId = entityId(row.person);
        const startDate = calendarDate(row.start);
        const kind = row.kind === "hos" || row.kind === "hog" ? row.kind : null;
        const context = code ? contexts.get(code) : undefined;
        const isTracked =
            kind === "hog" || (context && countrySourceFor(context.code).includeHeadOfState);
        return code && personId && startDate && kind && isTracked
            ? [
                  {
                      code,
                      endDate: calendarDate(row.end),
                      kind,
                      officeId: `${kind}:${code}`,
                      personId,
                      startDate,
                  },
              ]
            : [];
    });
    return [...groupBy(statements, (statement) => statement.officeId).values()]
        .flatMap((group) => {
            const [first] = group;
            return first
                ? normalizeTerms(group).map((term) => ({
                      ...term,
                      code: first.code,
                      kind: first.kind,
                  }))
                : [];
        })
        .concat(overrideStatements(contexts))
        .filter((term) => term.endDate === null || term.endDate >= since);
};

/** Whether a draft already holds a position of that kind in that country overlapping the term. */
const hasOverlapping = (draft: OfficialDraft, term: LeaderStatement): boolean =>
    draft.positions.some(
        (position) =>
            (position.countryCode ?? draft.countryCode) === term.code &&
            position.categories.includes(LEADER_KINDS[term.kind].category) &&
            (position.startDate === null ||
                term.endDate === null ||
                position.startDate <= term.endDate) &&
            (position.endDate === null || position.endDate >= term.startDate)
    );

/**
 * Adds the leaders recorded only on country items: new people, or terms the office query
 * missed. Their title is the generic "Head of state" or "Head of government".
 */
const addStatementTerms = async (
    drafts: Map<string, OfficialDraft>,
    statements: readonly LeaderStatement[]
): Promise<void> => {
    const newPeople = await fetchEntities(
        [...new Set(statements.map((term) => term.personId))].filter((id) => !drafts.has(id)),
        ["labels", "aliases"]
    );
    for (const term of statements) {
        const known = drafts.get(term.personId);
        if (known && hasOverlapping(known, term) && !term.isOverride) {
            continue;
        }
        const person = newPeople.get(term.personId);
        const draft: OfficialDraft = known ?? {
            aliases: [...(person?.aliases ?? [])],
            countryCode: term.code,
            name: person?.label ?? term.personId,
            positions: [],
            sources: [{ label: "Wikidata", url: wikidataUrl(term.personId) }],
            wikidataId: term.personId,
        };
        const { category, title } = LEADER_KINDS[term.kind];
        draft.positions.push({
            categories: [category],
            countryCode: term.code,
            endDate: term.endDate,
            ministry: null,
            portfolio: null,
            startDate: term.startDate,
            title: term.title ?? title,
        });
        drafts.set(term.personId, draft);
    }
};

interface LeaderSources {
    contexts: ReadonlyMap<CountryCode, CountryContext>;
    /** Extra offices per country (ministers, the US cabinet), already resolved to item ids. */
    extraOffices: ReadonlyMap<CountryCode, readonly string[]>;
    /** Roles of offices found by class; other offices are classified from their labels. */
    officeRoles: ReadonlyMap<string, OfficeRole>;
    /** Terms that ended before this year are left out. */
    sinceYear: number;
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
    officeRoles,
    sinceYear,
}: LeaderSources): Promise<Map<string, OfficialDraft>> => {
    const countryByOffice = new Map<string, CountryContext>();
    for (const context of contexts.values()) {
        const offices = [
            context.headOfStateOffice,
            context.headOfGovernmentOffice,
            ...context.formerHeadOfStateOffices,
            ...context.formerHeadOfGovernmentOffices,
            ...(extraOffices.get(context.code) ?? []),
        ];
        for (const office of offices) {
            if (office) {
                countryByOffice.set(office, context);
            }
        }
    }

    const terms = await fetchOfficeTerms([...countryByOffice.keys()], sinceYear);
    const people = await fetchEntities(
        [...new Set([...countryByOffice.keys(), ...terms.map((term) => term.personId)])],
        ["labels", "aliases"]
    );

    // Offices of a predecessor state come last, so a person who also led another country (George
    // VI, King of India as well as of the United Kingdom) stays filed under that country.
    const formerOffices = new Set(
        [...contexts.values()].flatMap((context) => [
            ...context.formerHeadOfStateOffices,
            ...context.formerHeadOfGovernmentOffices,
        ])
    );
    const isFormer = (term: OfficeTerm): number => Number(formerOffices.has(term.officeId));
    const drafts = new Map<string, OfficialDraft>();
    for (const term of terms.toSorted((a, b) => isFormer(a) - isFormer(b))) {
        const context = countryByOffice.get(term.officeId);
        const officeLabel = people.get(term.officeId)?.label;
        const known = drafts.get(term.personId);
        const isAnotherCountrysLeader =
            known !== undefined && context !== undefined && known.countryCode !== context.code;
        if (!(context && officeLabel) || (isFormer(term) && isAnotherCountrysLeader)) {
            continue;
        }
        const draft: OfficialDraft = drafts.get(term.personId) ?? {
            aliases: [...(people.get(term.personId)?.aliases ?? [])],
            countryCode: context.code,
            name: people.get(term.personId)?.label ?? term.personId,
            positions: [],
            sources: [{ label: "Wikidata", url: wikidataUrl(term.personId) }],
            wikidataId: term.personId,
        };
        draft.positions.push(
            positionFromTerm(term, capitalize(officeLabel), context, officeRoles.get(term.officeId))
        );
        drafts.set(term.personId, draft);
    }
    await addStatementTerms(drafts, await fetchLeaderStatements(contexts, sinceYear));
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
                const code = position.countryCode ?? draft.countryCode;
                const list = leaders.get(code) ?? [];
                list.push({ name: draft.name, startDate: position.startDate });
                leaders.set(code, list);
            }
        }
    }
    return leaders;
};

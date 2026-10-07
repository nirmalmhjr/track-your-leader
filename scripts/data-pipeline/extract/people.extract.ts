import type { CountryCode } from "@/types/geo.types";
import type { IsoDate, RoleCategory } from "@/types/travel.types";

import { chunk, groupBy } from "../lib/collections";
import { addDaysIso, isoFromParts, isValidDay } from "../lib/dates";
import { log } from "../lib/log";
import { capitalize, stripParenthetical } from "../lib/text";
import { type QleverRow, runQlever } from "../sources/qlever";
import { commonsImageUrl, wikidataUrl } from "../sources/wikidata";
import type { CountryContext, OfficialDraft, PositionDraft } from "../types";
import { leaderCategoriesOf } from "./leaders.extract";
import { countryCodeOfName } from "./places.resolve";
import { classifyTitle, type RoleInfo } from "./roles";

/**
 * Everyone politically exposed, from Wikidata (CC0): every person who held a public office
 * whose jurisdiction is a country or a place in it, classified into the explorer's roles. The
 * leaders pipeline covers heads of state and government and a few ministries in depth; this
 * covers everyone else: every ministry, legislators, regional and city leaders, judges,
 * diplomats, central bankers, military chiefs and party leaders.
 *
 * The questions are too big for the Wikidata query service, so they go to QLever, in four
 * steps: which classes count (once), who held which office in each country, what each office
 * is, and each person's name, photo and party.
 */

/** Kinds of office recognised from Wikidata's class tree, in the order they are checked. */
const ROOT_KINDS = [
    "minister",
    "legislator",
    "judiciary",
    "diplomat",
    "mayor",
    "governor",
    "military",
    "party",
    "head_of_state",
    "public_office",
] as const;
type RootKind = (typeof ROOT_KINDS)[number];

/** Wikidata classes each kind covers, with all their subclasses. */
const ROOT_CLASSES: Readonly<Record<RootKind, readonly string[]>> = {
    diplomat: ["Q193391", "Q121998"], // diplomat, ambassador
    governor: ["Q132050"],
    head_of_state: ["Q48352"],
    judiciary: ["Q16533", "Q1501926"], // judge, attorney general
    legislator: ["Q4175034", "Q486839"], // legislator, member of parliament
    mayor: ["Q30185"],
    military: ["Q189290", "Q83460"], // military officer, general
    minister: ["Q83307"],
    party: ["Q1553195"], // party leader
    public_office: ["Q294414"],
};

/** Role given to an office known only by its class. `null`: the title must say more. */
const ROOT_ROLE: Readonly<Record<RootKind, RoleCategory | null>> = {
    diplomat: "diplomat",
    governor: "regional_leader",
    head_of_state: "senior_official",
    judiciary: "judiciary",
    legislator: "legislator",
    mayor: "local_leader",
    military: "military_leader",
    minister: "minister",
    party: "party_leader",
    public_office: "senior_official",
};

/** Roles of offices held by many people at once, whose missing end dates are common. */
const SHARED_OFFICE_ROLES: ReadonlySet<RoleCategory> = new Set([
    "legislator",
    "local_leader",
    "regional_leader",
    "judiciary",
    "diplomat",
]);

/** Wikidata classes that tell a territory from a body that merely sits in a country. */
const INTERNATIONAL_ORGANIZATION = "Q484652";
const TERRITORIAL_ENTITY = "Q56061"; // administrative territorial entity
const STATE = "Q7275";
const SOVEREIGN_STATE = "Q3624078";

/** City offices count from this population, or in a capital. */
const LOCAL_POPULATION_MIN = 100_000;
/** An open-ended term in a shared office that started this long ago most likely ended. */
const STALE_OPEN_TERM_YEARS = 25;
/** People with no dated term count if born from this year or died from the horizon on. */
const EARLIEST_BIRTH_YEAR = 1890;
/** Open-ended terms count if they started at most this long before the horizon. */
const OPEN_TERM_LEAD_YEARS = 20;

const DAYS_PER_YEAR = 365;
const POSITION_BATCH_SIZE = 500;
const PERSON_BATCH_SIZE = 1000;
const HOURS_PER_DAY = 24;
/** Class trees and offices barely change; who holds them is refreshed weekly. */
const CLASS_TTL_HOURS = 30 * HOURS_PER_DAY;
const POSITION_TTL_HOURS = 30 * HOURS_PER_DAY;
const HOLDINGS_TTL_HOURS = 6 * HOURS_PER_DAY;
const PHOTO_WIDTH = 160;
const DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;
const COMMONS_FILE = /Special:FilePath\/(.+)$/;
/** Names written in Latin letters only (accents allowed). */
const LATIN_NAME = /^[\p{Script=Latin}\p{M}\s.,'’()-]+$/u;
/** Name languages tried when a person has no English or multilingual label. */
const FALLBACK_NAME_LANGUAGES = [
    "es",
    "fr",
    "de",
    "pt",
    "it",
    "nl",
    "ru",
    "uk",
    "pl",
    "tr",
    "ar",
    "fa",
    "hi",
    "ne",
    "bn",
    "ur",
    "zh",
    "ja",
    "ko",
    "id",
];

const values = (ids: readonly string[]): string => ids.map((id) => `wd:${id}`).join(" ");

/** A calendar date from a SPARQL date-time, or `null` for BCE, odd or missing values. */
const toIsoDate = (value: string | undefined): IsoDate | null => {
    const match = value?.match(DATE_PREFIX);
    if (!match) {
        return null;
    }
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    return isValidDay(year, month, day) ? isoFromParts(year, month, day) : null;
};

// --- Classes --------------------------------------------------------------------------------

/**
 * Maps every class under the recognised roots to the kinds it belongs to.
 *
 * @returns Kinds per class id.
 */
const fetchClassKinds = async (): Promise<Map<string, Set<RootKind>>> => {
    const kinds = new Map<string, Set<RootKind>>();
    for (const kind of ROOT_KINDS) {
        for (const root of ROOT_CLASSES[kind]) {
            // biome-ignore lint/performance/noAwaitInLoops: one query at a time keeps QLever happy.
            const rows = await runQlever(
                `SELECT ?c WHERE { ?c wdt:P279* wd:${root} }`,
                CLASS_TTL_HOURS
            );
            for (const row of rows) {
                if (row.c) {
                    const set = kinds.get(row.c) ?? new Set<RootKind>();
                    set.add(kind);
                    kinds.set(row.c, set);
                }
            }
        }
    }
    return kinds;
};

// --- Holdings -------------------------------------------------------------------------------

export interface Holding {
    born: IsoDate | null;
    died: IsoDate | null;
    endDate: IsoDate | null;
    personId: string;
    positionId: string;
    startDate: IsoDate | null;
}

/**
 * Everyone who held an office of the country, of a place in it, or of a kind the country owns
 * ("ambassador of Nepal to India" is a kind of "ambassador of Nepal", though filed under India),
 * with their terms. A term is dated by its own qualifiers or, for legislators, by the
 * parliamentary term it names.
 */
const fetchHoldings = async (countryId: string): Promise<Holding[]> => {
    const rows = await runQlever(
        `SELECT ?person ?pos ?start ?end ?termStart ?termEnd ?born ?died WHERE {
            { ?pos wdt:P1001 wd:${countryId} } UNION { ?pos wdt:P17 wd:${countryId} }
            UNION { ?pos wdt:P1001 ?place . ?place wdt:P17 wd:${countryId} }
            UNION { ?pos wdt:P279 ?parent . ?parent wdt:P1001 wd:${countryId} }
            ?person p:P39 ?st . ?st ps:P39 ?pos .
            ?person wdt:P31 wd:Q5 .
            OPTIONAL { ?st pq:P580 ?start } OPTIONAL { ?st pq:P582 ?end }
            OPTIONAL { ?st pq:P2937 ?term .
                OPTIONAL { ?term wdt:P580 ?termStart } OPTIONAL { ?term wdt:P582 ?termEnd } }
            OPTIONAL { ?person wdt:P569 ?born } OPTIONAL { ?person wdt:P570 ?died }
        }`,
        HOLDINGS_TTL_HOURS
    );
    const unique = new Map<string, Holding>();
    for (const row of rows) {
        if (!(row.person && row.pos)) {
            continue;
        }
        const holding: Holding = {
            born: toIsoDate(row.born),
            died: toIsoDate(row.died),
            endDate: toIsoDate(row.end) ?? toIsoDate(row.termEnd),
            personId: row.person,
            positionId: row.pos,
            startDate: toIsoDate(row.start) ?? toIsoDate(row.termStart),
        };
        unique.set(
            `${holding.personId}|${holding.positionId}|${holding.startDate}|${holding.endDate}`,
            holding
        );
    }
    return [...unique.values()];
};

// --- Offices --------------------------------------------------------------------------------

export interface OfficeInfo {
    /** Countries the office itself names (`P17`). */
    countries: Set<string>;
    isCapital: boolean;
    /** Its jurisdictions (`P1001`): places, or bodies such as the Council of Europe. */
    jurisdictions: Set<string>;
    kinds: Set<RootKind>;
    label: string | null;
    /**
     * Jurisdictions of the office's parent classes. For "ambassador of the United Kingdom to
     * Nepal" that is the UK (from "ambassador of the United Kingdom"): the sending state, whereas
     * the office's own country is the host.
     */
    parentJurisdictions: Set<string>;
    population: number;
    /** Whether a jurisdiction is an international body (the UN, NATO), not a territory. */
    servesInternationalBody: boolean;
    /** Sovereign states among its countries. */
    states: Set<string>;
}

/**
 * Adds one row of the offices query to what is known of the office.
 *
 * @param known - The office so far, or `undefined` on its first row.
 * @param row - The row; its `pos` is the office.
 * @param classKinds - Kinds per class id.
 * @returns The office, updated.
 */
const addOfficeRow = (
    known: OfficeInfo | undefined,
    row: QleverRow,
    classKinds: ReadonlyMap<string, ReadonlySet<RootKind>>
): OfficeInfo => {
    const office = known ?? {
        countries: new Set<string>(),
        isCapital: false,
        jurisdictions: new Set<string>(),
        kinds: new Set(classKinds.get(row.pos ?? "") ?? []),
        label: null,
        parentJurisdictions: new Set<string>(),
        population: 0,
        servesInternationalBody: false,
        states: new Set<string>(),
    };
    office.label = office.label ?? row.en ?? row.mul ?? null;
    for (const kind of (row.cls && classKinds.get(row.cls)) || []) {
        office.kinds.add(kind);
    }
    if (row.parentPlace) {
        office.parentJurisdictions.add(row.parentPlace);
    }
    if (row.place) {
        office.jurisdictions.add(row.place);
    }
    if (row.country) {
        office.countries.add(row.country);
        if (row.state !== undefined) {
            office.states.add(row.country);
        }
    }
    office.population = Math.max(office.population, Number(row.pop) || 0);
    office.isCapital ||= row.capital !== undefined;
    office.servesInternationalBody ||= row.international !== undefined;
    return office;
};

const fetchOffices = async (
    ids: readonly string[],
    classKinds: ReadonlyMap<string, ReadonlySet<RootKind>>
): Promise<Map<string, OfficeInfo>> => {
    const offices = new Map<string, OfficeInfo>();
    for (const batch of chunk([...new Set(ids)].sort(), POSITION_BATCH_SIZE)) {
        // biome-ignore lint/performance/noAwaitInLoops: one query at a time keeps QLever happy.
        const rows = await runQlever(
            `SELECT ?pos ?en ?mul ?cls ?parentPlace ?place ?pop ?capital ?international
                ?country ?state WHERE {
                VALUES ?pos { ${values(batch)} }
                OPTIONAL { ?pos rdfs:label ?en FILTER(LANG(?en) = "en") }
                OPTIONAL { ?pos rdfs:label ?mul FILTER(LANG(?mul) = "mul") }
                OPTIONAL { ?pos wdt:P31|wdt:P279 ?cls OPTIONAL { ?cls wdt:P1001 ?parentPlace } }
                OPTIONAL { ?pos wdt:P1001 ?place . OPTIONAL { ?place wdt:P1082 ?pop }
                    OPTIONAL { ?anyCountry wdt:P36 ?place BIND(1 AS ?capital) }
                    OPTIONAL { ?place wdt:P31/wdt:P279* wd:${INTERNATIONAL_ORGANIZATION}
                        FILTER NOT EXISTS { ?place wdt:P31/wdt:P279* wd:${TERRITORIAL_ENTITY} }
                        FILTER NOT EXISTS { ?place wdt:P31/wdt:P279* wd:${STATE} }
                        BIND(1 AS ?international) } }
                OPTIONAL { ?pos wdt:P17 ?country
                    OPTIONAL { ?country wdt:P31 wd:${SOVEREIGN_STATE} BIND(1 AS ?state) } }
            }`,
            POSITION_TTL_HOURS
        );
        for (const row of rows) {
            if (row.pos) {
                offices.set(row.pos, addOfficeRow(offices.get(row.pos), row, classKinds));
            }
        }
    }
    return offices;
};

/**
 * "King of …", "Tsar of …", "Mwami of …": titles only reigning monarchs bear, with the realm they
 * name. Queens, empresses, princes, grand duchesses and emirs are left out: consorts, heirs and
 * militant leaders ("Emir of the Islamic State of Iraq") bear those titles too, and today's
 * monarchs who use them hold their country's own leader office anyway.
 */
const MONARCH_OF =
    /^(?:king|emperor|shah|shahanshah|sultan|grand duke|bey|mwami|tsar|negus|monarch|yang di-pertuan agong)\s+of\s+(.+)$/i;
/** Realms named by their people. */
const REALM_PEOPLE: Readonly<Record<string, CountryCode>> = {
    hellenes: "GRC",
    "the hellenes": "GRC",
};

/**
 * Whether a title is the monarch of the given country ("Sultan of the Maldives" for MDV).
 *
 * @param title - Office title.
 * @param code - Country whose officials are being collected.
 * @returns `true` when the title names the country's monarch.
 */
export const isMonarchOf = (title: string, code: CountryCode): boolean => {
    const realm = title.match(MONARCH_OF)?.[1];
    return (
        realm !== undefined &&
        (REALM_PEOPLE[realm.toLowerCase()] ?? countryCodeOfName(realm)) === code
    );
};

/** "… to Nepal", "… in the United States": the country an envoy is posted to. */
const ENVOY_HOST = /\b(?:to|in)\s+(.+)$/i;
/** "Ambassador of Israel to …": the state that sends the envoy. */
const ENVOY_SENDER = /\bof\s+(.+?)\s+(?:to|in)\s/i;

/**
 * Whether a diplomatic title names a post in this country held for another state, such as
 * "Ambassador of Israel to Nepal" for Nepal. Wikidata files such posts under the host and often
 * records neither the sending state nor the envoy's citizenship, so the title is the only clue.
 *
 * @param title - Office title.
 * @param code - Country whose officials are being collected.
 * @returns `true` for a foreign envoy posted to the country.
 */
export const isEnvoyPostedTo = (title: string, code: CountryCode): boolean => {
    const host = title.match(ENVOY_HOST)?.[1];
    if (!host || countryCodeOfName(host) !== code) {
        return false;
    }
    const sender = title.match(ENVOY_SENDER)?.[1];
    return !sender || countryCodeOfName(sender) !== code;
};

/**
 * Whether an office is the country's own. Offices are collected when their jurisdiction merely
 * lies in the country, and Wikidata gives bodies a country too: the Council of Europe lies in
 * France (it sits in Strasbourg), and the Islamic Community of India in India, Nepal, Sri Lanka
 * and the Maldives. So an office tied to the country only through its jurisdiction doesn't count
 * when that jurisdiction is an international body, or when the office names another sovereign
 * state as its own ("Grand Mufti of India" names India). Offices of territories (Gibraltar, Hong
 * Kong) and of former states (the Soviet Union) stay with the country they lie in.
 *
 * @param office - What Wikidata says about the office.
 * @param context - The country whose officials are being collected.
 * @returns `false` for another state's office, or an international body's.
 */
export const isOfficeOfCountry = (office: OfficeInfo, context: CountryContext): boolean => {
    const country = context.wikidataId;
    const isTiedDirectly =
        office.countries.has(country) ||
        office.jurisdictions.has(country) ||
        office.parentJurisdictions.has(country);
    return isTiedDirectly || !(office.servesInternationalBody || office.states.size > 0);
};

/**
 * Turns an office into a role, or `null` for offices that aren't politically exposed (academic
 * posts, honorary titles), offices of other states and international bodies, and offices of
 * small towns.
 *
 * @param officeId - Office item.
 * @param office - What Wikidata says about it.
 * @param context - The country's leader offices.
 * @returns The role and display title.
 */
export const classifyOffice = (
    officeId: string,
    office: OfficeInfo,
    context: CountryContext
): RoleInfo | null => {
    if (!office.label) {
        return null;
    }
    const title = capitalize(stripParenthetical(office.label));
    const fromTitle = classifyTitle(title);
    const [leaderCategory] = leaderCategoriesOf(officeId, context);
    if (leaderCategory) {
        return { ...fromTitle, categories: [leaderCategory], ministry: null, portfolio: null };
    }
    if (!isOfficeOfCountry(office, context)) {
        return null;
    }
    // "King of Egypt", "Emperor of Ethiopia": the monarch of a kingdom the country was, which
    // isn't one of its leader offices.
    if (isMonarchOf(title, context.code)) {
        return { ...fromTitle, categories: ["head_of_state"], ministry: null, portfolio: null };
    }
    const [titleCategory] = fromTitle.categories;
    const titleIsSpecific = titleCategory !== "senior_official";
    const kind = ROOT_KINDS.find((candidate) => office.kinds.has(candidate));
    const categoryFromClass = kind ? ROOT_ROLE[kind] : null;
    const category = titleIsSpecific ? titleCategory : categoryFromClass;
    if (!category) {
        return null;
    }
    // An embassy belongs to the state that sends the ambassador, not the one hosting them.
    const isForeignEnvoy =
        category === "diplomat" &&
        office.parentJurisdictions.size > 0 &&
        !office.parentJurisdictions.has(context.wikidataId);
    if (isForeignEnvoy || (category === "diplomat" && isEnvoyPostedTo(title, context.code))) {
        return null;
    }
    const isLocal = category === "local_leader";
    if (isLocal && !(office.isCapital || office.population >= LOCAL_POPULATION_MIN)) {
        return null;
    }
    return { ...fromTitle, categories: [category] };
};

// --- People ---------------------------------------------------------------------------------

interface PersonInfo {
    /** Countries of citizenship (`P27`). */
    citizenships: Set<string>;
    name: string | null;
    party: string | null;
    photoUrl: string | null;
}

const photoFrom = (value: string | undefined): string | null => {
    const file = value?.match(COMMONS_FILE)?.[1];
    return file ? commonsImageUrl(decodeURIComponent(file), PHOTO_WIDTH) : null;
};

const fetchPeople = async (ids: readonly string[]): Promise<Map<string, PersonInfo>> => {
    const people = new Map<string, PersonInfo>();
    for (const batch of chunk([...new Set(ids)].sort(), PERSON_BATCH_SIZE)) {
        // biome-ignore lint/performance/noAwaitInLoops: one query at a time keeps QLever happy.
        const rows = await runQlever(
            `SELECT ?person ?en ?mul ?image ?partyLabel ?citizenship WHERE {
                VALUES ?person { ${values(batch)} }
                OPTIONAL { ?person wdt:P27 ?citizenship }
                OPTIONAL { ?person rdfs:label ?en FILTER(LANG(?en) = "en") }
                OPTIONAL { ?person rdfs:label ?mul FILTER(LANG(?mul) = "mul") }
                OPTIONAL { ?person wdt:P18 ?image }
                OPTIONAL { ?person wdt:P102 ?party .
                    ?party rdfs:label ?partyLabel FILTER(LANG(?partyLabel) = "en") }
            }`,
            HOLDINGS_TTL_HOURS
        );
        for (const row of rows) {
            if (!row.person) {
                continue;
            }
            const person = people.get(row.person) ?? {
                citizenships: new Set<string>(),
                name: null,
                party: null,
                photoUrl: null,
            };
            if (row.citizenship) {
                person.citizenships.add(row.citizenship);
            }
            person.name = person.name ?? row.en ?? row.mul ?? null;
            person.photoUrl = person.photoUrl ?? photoFrom(row.image);
            person.party = person.party ?? row.partyLabel ?? null;
            people.set(row.person, person);
        }
    }

    // People named only in their own language (a provincial minister in Nepali, say): the first
    // label found in a preferred language, otherwise any.
    const unnamed = [...people].filter(([, person]) => !person.name).map(([id]) => id);
    for (const batch of chunk(unnamed, PERSON_BATCH_SIZE)) {
        // biome-ignore lint/performance/noAwaitInLoops: one query at a time keeps QLever happy.
        const rows = await runQlever(
            `SELECT ?person ?label ?language WHERE {
                VALUES ?person { ${values(batch)} }
                ?person rdfs:label ?label . BIND(LANG(?label) AS ?language)
            }`,
            HOLDINGS_TTL_HOURS
        );
        const preference = (language: string | undefined): number => {
            const rank = FALLBACK_NAME_LANGUAGES.indexOf(language ?? "");
            return rank === -1 ? FALLBACK_NAME_LANGUAGES.length : rank;
        };
        for (const [personId, labels] of groupBy(rows, (row) => row.person ?? "")) {
            const person = people.get(personId);
            // A name in Latin letters, in any language, reads in the English app ("Bilen Saliu"
            // in Albanian before "Билен Салиу" in Macedonian).
            const latinFirst = (label: string | undefined): number =>
                LATIN_NAME.test(label ?? "") ? 0 : 1;
            const [best] = labels
                .filter((row) => row.label)
                .sort(
                    (a, b) =>
                        latinFirst(a.label) - latinFirst(b.label) ||
                        preference(a.language) - preference(b.language)
                );
            if (person && best?.label) {
                person.name = best.label;
            }
        }
    }
    return people;
};

// --- Terms ----------------------------------------------------------------------------------

/**
 * A holding as a position in the period, or `null` when it ended before the horizon. Missing
 * end dates are filled from the person's death; a long-open term in an office many people hold
 * at once is marked as of unknown end rather than shown as current.
 */
export const positionFromHolding = (
    holding: Holding,
    role: RoleInfo,
    since: IsoDate,
    today: IsoDate
): PositionDraft | null => {
    const { born, died, startDate } = holding;
    const endDate = holding.endDate ?? (startDate ? died : null);
    const base = {
        categories: role.categories,
        ministry: role.ministry,
        portfolio: role.portfolio,
        title: role.title,
    };

    if (!(startDate || endDate)) {
        const isInPeriod =
            (born !== null && born >= `${EARLIEST_BIRTH_YEAR}-01-01`) ||
            (died !== null && died >= since);
        return isInPeriod ? { ...base, endDate: null, startDate: null, undated: true } : null;
    }
    if (endDate) {
        return endDate >= since ? { ...base, endDate, startDate } : null;
    }
    // Open-ended, with a start date.
    if (startDate && startDate < addDaysIso(since, -OPEN_TERM_LEAD_YEARS * DAYS_PER_YEAR)) {
        return null;
    }
    const isShared = role.categories.some((category) => SHARED_OFFICE_ROLES.has(category));
    const isStale =
        startDate !== null && startDate < addDaysIso(today, -STALE_OPEN_TERM_YEARS * DAYS_PER_YEAR);
    return isShared && isStale
        ? { ...base, endDate: null, startDate, undated: true }
        : { ...base, endDate: null, startDate };
};

/** Same office and start: kept once (parliamentary terms repeat the statement's own dates). */
const dedupePositions = (positions: readonly PositionDraft[]): PositionDraft[] => [
    ...new Map(
        positions.map((position) => [
            `${position.title}|${position.startDate}|${position.endDate}|${position.undated ?? ""}`,
            position,
        ])
    ).values(),
];

// --- Assembly -------------------------------------------------------------------------------

/**
 * Drops embassy posts filed under the host country: an ambassador to Nepal is listed under
 * Nepal on Wikidata whichever state sent them, so a diplomatic post only counts for a country
 * its holder is a citizen of (when citizenship is recorded at all).
 */
const withoutForeignEnvoys = (
    byCountry: ReadonlyMap<CountryCode, PositionDraft[]>,
    person: PersonInfo,
    contexts: ReadonlyMap<CountryCode, CountryContext>
): Map<CountryCode, PositionDraft[]> => {
    const kept = new Map<CountryCode, PositionDraft[]>();
    for (const [code, positions] of byCountry) {
        const countryId = contexts.get(code)?.wikidataId ?? "";
        const isForeign = person.citizenships.size > 0 && !person.citizenships.has(countryId);
        const own = isForeign
            ? positions.filter((position) => !position.categories.includes("diplomat"))
            : positions;
        if (own.length > 0) {
            kept.set(code, own);
        }
    }
    return kept;
};

/** A person with a role in the period, with what QLever said about them. */
export interface PersonDraft extends OfficialDraft {
    party: string | null;
    photoUrl: string | null;
    wikidataId: string;
}

interface PeopleInput {
    contexts: ReadonlyMap<CountryCode, CountryContext>;
    sinceYear: number;
    today: IsoDate;
}

/**
 * Collects everyone politically exposed in the given countries. Someone with offices in several
 * countries is filed under the country where they held the most, with every position kept.
 *
 * @returns Drafts keyed by Wikidata id.
 */
export const extractPeople = async ({
    contexts,
    sinceYear,
    today,
}: PeopleInput): Promise<Map<string, PersonDraft>> => {
    const since = `${sinceYear}-01-01`;
    log.info("Office classes");
    const classKinds = await fetchClassKinds();

    const positionsByPerson = new Map<string, Map<CountryCode, PositionDraft[]>>();
    let done = 0;
    for (const context of contexts.values()) {
        // biome-ignore lint/performance/noAwaitInLoops: countries go one by one, gently.
        const holdings = await fetchHoldings(context.wikidataId);
        const offices = await fetchOffices(
            holdings.map((holding) => holding.positionId),
            classKinds
        );
        let kept = 0;
        for (const holding of holdings) {
            const office = offices.get(holding.positionId);
            const role = office ? classifyOffice(holding.positionId, office, context) : null;
            const position = role ? positionFromHolding(holding, role, since, today) : null;
            if (!position) {
                continue;
            }
            const byCountry = positionsByPerson.get(holding.personId) ?? new Map();
            byCountry.set(context.code, [...(byCountry.get(context.code) ?? []), position]);
            positionsByPerson.set(holding.personId, byCountry);
            kept += 1;
        }
        done += 1;
        log.info(`${context.code}: ${kept} terms (${done}/${contexts.size})`);
    }

    log.info(`Names, photos and parties of ${positionsByPerson.size} people`);
    const people = await fetchPeople([...positionsByPerson.keys()]);
    const drafts = new Map<string, PersonDraft>();
    for (const [personId, allByCountry] of positionsByPerson) {
        const person = people.get(personId);
        if (!person?.name) {
            continue;
        }
        const byCountry = withoutForeignEnvoys(allByCountry, person, contexts);
        if (byCountry.size === 0) {
            continue;
        }
        const [countryCode] = [...byCountry].sort(
            (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])
        )[0];
        drafts.set(personId, {
            aliases: [],
            countryCode,
            name: stripParenthetical(person.name),
            party: person.party,
            photoUrl: person.photoUrl,
            positions: dedupePositions([...byCountry.values()].flat()),
            sources: [{ label: "Wikidata", url: wikidataUrl(personId) }],
            wikidataId: personId,
        });
    }
    const byCountry = groupBy([...drafts.values()], (draft) => draft.countryCode);
    log.info(`${drafts.size} people in ${byCountry.size} countries`);
    return drafts;
};

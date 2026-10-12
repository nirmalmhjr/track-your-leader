import type { GeneratedOfficial } from "@/features/travel-explorer/data/generated-data.schema";
import { ROLE_RANK } from "@/lib/travel/travel.constants";
import type { CountryCode } from "@/types/geo.types";
import type { IsoDate, SourceRef } from "@/types/travel.types";

import { log } from "../lib/log";
import {
    capitalize,
    cleanText,
    isLatinName,
    normalizeName,
    slugify,
    stripParenthetical,
    toLatinName,
} from "../lib/text";
import type { WarehouseOfficial } from "../lib/warehouse";
import { categoryPortrait } from "../sources/commons";
import {
    parliamentPortrait,
    UK_PARLIAMENT_ID,
    US_CONGRESS_ID,
} from "../sources/parliament-portraits";
import {
    claimsOf,
    commonsImageUrl,
    fetchAllLabels,
    fetchEntities,
    PROPERTY,
    qualifier,
    snakDate,
    snakItem,
    snakString,
    type WikidataEntity,
} from "../sources/wikidata";
import { fetchIntros, fetchPageImages, PHOTO_LANGUAGES, wikipediaUrl } from "../sources/wikipedia";
import type { OfficialDraft, PositionDraft } from "../types";
import { overriddenName } from "./leaders.overrides";
import { classifyTitle } from "./roles";
import { type Roster, rosterKey } from "./roster";

const PHOTO_WIDTH = 160;
/** Removes pronunciation and native-script asides such as "(SHEE jin-PING; Chinese: 习近平)". */
const PRONUNCIATION_ASIDE = /\s*\([^()]*;[^()]*\)/g;
/** Words that say nothing about which ministry a title refers to. */
const GENERIC_TITLE_WORDS = new Set([
    "affairs",
    "and",
    "cabinet",
    "department",
    "deputy",
    "federal",
    "for",
    "government",
    "minister",
    "ministry",
    "national",
    "of",
    "secretary",
    "state",
    "the",
    "union",
]);

// --- Assembly -----------------------------------------------------------------------------

const addSource = (draft: OfficialDraft, source: SourceRef | null): void => {
    if (source && !draft.sources.some((existing) => existing.url === source.url)) {
        draft.sources.push(source);
    }
};

/**
 * Combines Wikidata leaders with roster members. Someone who is both (a prime minister who
 * also runs a ministry) becomes one official with all positions.
 *
 * @param leaders - Leader drafts keyed by Wikidata id.
 * @param roster - Cabinet roster after identity matching.
 * @param cabinetUrls - CIA page per country, used as the source link for roster positions.
 * @returns One draft per person.
 */
export const assembleDrafts = (
    leaders: ReadonlyMap<string, OfficialDraft>,
    roster: Roster,
    cabinetUrls: ReadonlyMap<CountryCode, string>
): OfficialDraft[] => {
    const drafts = new Map<string, OfficialDraft>();
    for (const [id, leader] of leaders) {
        drafts.set(id, {
            ...leader,
            positions: [...leader.positions],
            sources: [...leader.sources],
        });
    }

    for (const [key, member] of Object.entries(roster)) {
        const positions = Object.entries(member.positions).map(([title, term]): PositionDraft => {
            const role = classifyTitle(title);
            return {
                categories: role.categories,
                endDate: term.endedOn,
                ministry: role.ministry,
                portfolio: role.portfolio,
                startDate: term.since,
                title: role.title,
            };
        });
        const cabinetUrl = cabinetUrls.get(member.countryCode);
        const source = cabinetUrl ? { label: "CIA World Leaders", url: cabinetUrl } : null;
        const draftKey = member.wikidataId ?? key;
        const existing = drafts.get(draftKey);

        if (existing) {
            existing.positions.push(...positions);
            addSource(existing, source);
            continue;
        }
        drafts.set(draftKey, {
            aliases: [],
            countryCode: member.countryCode,
            name: member.name,
            positions,
            sources: source ? [source] : [],
            wikidataId: member.wikidataId,
        });
    }
    return [...drafts.values()];
};

// --- Enrichment ---------------------------------------------------------------------------

const significantWords = (title: string): Set<string> =>
    new Set(
        normalizeName(title)
            .split(" ")
            .filter((word) => word.length > 2 && !GENERIC_TITLE_WORDS.has(word))
    );

/**
 * Fills unknown start dates of current positions from Wikidata, matching the person's open
 * "position held" statements to the title by shared words ("Finance" in both).
 */
const fillStartDates = async (
    drafts: readonly OfficialDraft[],
    people: ReadonlyMap<string, WikidataEntity>
): Promise<void> => {
    const openStatements = new Map<string, { officeId: string; startDate: string }[]>();
    for (const draft of drafts) {
        const person = draft.wikidataId ? people.get(draft.wikidataId) : undefined;
        if (!(person && draft.positions.some((position) => position.startDate === null))) {
            continue;
        }
        const statements = claimsOf(person, PROPERTY.positionHeld).flatMap((claim) => {
            const officeId = snakItem(claim.mainsnak);
            const startDate = snakDate(qualifier(claim, PROPERTY.startTime));
            const isOpen = !qualifier(claim, PROPERTY.endTime);
            return officeId && startDate && isOpen ? [{ officeId, startDate }] : [];
        });
        openStatements.set(person.id, statements);
    }

    const offices = await fetchEntities(
        [...openStatements.values()].flat().map((statement) => statement.officeId),
        ["labels"]
    );

    for (const draft of drafts) {
        const statements = draft.wikidataId ? openStatements.get(draft.wikidataId) : undefined;
        for (const position of draft.positions) {
            if (!statements || position.startDate !== null || position.endDate !== null) {
                continue;
            }
            const words = significantWords(position.title);
            const [best] = statements
                .map((statement) => {
                    const label = offices.get(statement.officeId)?.label ?? "";
                    const shared = [...significantWords(label)].filter((word) => words.has(word));
                    return { shared: shared.length, startDate: statement.startDate };
                })
                .filter((candidate) => candidate.shared > 0)
                .sort((a, b) => b.shared - a.shared || b.startDate.localeCompare(a.startDate));
            position.startDate = best?.startDate ?? null;
        }
    }
};

/** The current party, or the most recent one. */
const partyIdOf = (person: WikidataEntity): string | null => {
    const claims = claimsOf(person, PROPERTY.party);
    const current = claims.find((claim) => !qualifier(claim, PROPERTY.endTime)) ?? claims[0];
    return current ? snakItem(current.mainsnak) : null;
};

const summaryFor = (intro: string | undefined, person: WikidataEntity | undefined): string => {
    if (intro) {
        return cleanText(intro.replace(PRONUNCIATION_ASIDE, ""));
    }
    return person?.description ? `${capitalize(person.description)}.` : "";
};

// --- Ids ----------------------------------------------------------------------------------

/** What earlier runs recorded about someone, enough to give them the same id again. */
export type IdRecord = Pick<GeneratedOfficial, "countryCode" | "fullName" | "id" | "wikidataId">;

/**
 * Gives each official a readable id ("narendra-modi") that stays the same between runs, so
 * shared links keep working even if a name's spelling changes on Wikidata.
 *
 * @param drafts - People to name.
 * @param previous - Everyone earlier runs named.
 * @param reserved - Ids already taken by people outside `drafts`.
 * @returns The id of each draft.
 */
export const assignIds = (
    drafts: readonly OfficialDraft[],
    previous: readonly IdRecord[],
    reserved: ReadonlySet<string>
): Map<OfficialDraft, string> => {
    const previousByWikidata = new Map(
        previous.flatMap((official) =>
            official.wikidataId ? [[official.wikidataId, official.id] as const] : []
        )
    );
    const previousByName = new Map(
        previous.map((official) => [
            rosterKey(official.countryCode, official.fullName),
            official.id,
        ])
    );

    const ids = new Map<OfficialDraft, string>();
    const used = new Set<string>(reserved);
    const ordered = [...drafts].sort((a, b) =>
        (a.wikidataId ?? a.name).localeCompare(b.wikidataId ?? b.name)
    );
    for (const draft of ordered) {
        const remembered =
            (draft.wikidataId && previousByWikidata.get(draft.wikidataId)) ||
            previousByName.get(rosterKey(draft.countryCode, draft.name));
        // Names written only in non-Latin scripts have no slug; fall back to the Wikidata id.
        const base = slugify(draft.name) || (draft.wikidataId ?? "official").toLowerCase();
        const candidates = [
            remembered,
            base,
            `${base}-${draft.countryCode.toLowerCase()}`,
            `${base}-${(draft.wikidataId ?? String(ids.size)).toLowerCase()}`,
        ];
        const id = candidates.find((candidate) => candidate && !used.has(candidate)) ?? base;
        used.add(id);
        ids.set(draft, id);
    }
    return ids;
};

// --- Final shape --------------------------------------------------------------------------

const positionRank = (position: PositionDraft): number =>
    Math.min(...position.categories.map((category) => ROLE_RANK[category]));

/**
 * Positions without repeats: two sources can report the same term (the leaders step and the
 * people sweep both list "Minister of External Relations" from 2020), which shows twice otherwise.
 * When one report knows the term is current and the other only that its end is unknown, the
 * current one is kept.
 *
 * @param positions - Positions from every source.
 * @returns Each office and term once.
 */
export const uniquePositions = <T extends PositionDraft>(positions: readonly T[]): T[] => {
    const byTerm = new Map<string, T>();
    for (const position of positions) {
        const key = `${position.title}|${position.startDate}|${position.endDate}|${position.countryCode ?? ""}`;
        const known = byTerm.get(key);
        if (!known || (known.undated && !position.undated)) {
            byTerm.set(key, position);
        }
    }
    return [...byTerm.values()];
};

/** Languages whose labels are tried first for a name, after English. */
const NAME_LANGUAGES = [
    "en-gb",
    "en-ca",
    "en-us",
    "fr",
    "es",
    "de",
    "pt",
    "it",
    "nl",
    "id",
    "tr",
    "pl",
];

/**
 * The label to name someone by when Wikidata has no English one: Latin letters first (in any
 * language, the common ones before the rest), then whatever there is.
 *
 * @param labels - Labels by language code.
 * @returns The chosen label, or `null` when there are none.
 */
export const bestLabel = (labels: Readonly<Record<string, string>>): string | null => {
    const rank = (language: string, label: string): number => {
        const position = NAME_LANGUAGES.indexOf(language);
        return (
            (isLatinName(label) ? 0 : 100) + (position === -1 ? NAME_LANGUAGES.length : position)
        );
    };
    const [best] = Object.entries(labels).sort(([a, x], [b, y]) => rank(a, x) - rank(b, y));
    return best?.[1] ?? null;
};

/**
 * An official's name for the app and the other names they go by: Wikidata's English label, else
 * a Latin-script label from another language, else the name as found, transliterated where the
 * script allows (the original kept among the aliases, so search still finds it).
 */
const namesOf = (
    draft: OfficialDraft,
    person: WikidataEntity | undefined,
    otherLabels: ReadonlyMap<string, Record<string, string>>
): { aliases: string[]; fullName: string } => {
    const labels = draft.wikidataId ? otherLabels.get(draft.wikidataId) : undefined;
    const corrected = overriddenName(draft.wikidataId);
    const { name: fullName, original } = toLatinName(
        stripParenthetical(
            corrected ?? person?.label ?? (labels ? bestLabel(labels) : null) ?? draft.name
        )
    );
    // A label known to be wrong ("Hugo Chávez" for Guyana's PM) mustn't stay findable either.
    const wrongName = corrected ? person?.label : undefined;
    const aliases = [
        ...new Set([
            draft.name,
            ...draft.aliases,
            ...(person?.aliases ?? []),
            ...(original ? [original] : []),
        ]),
    ].filter((alias) => alias !== wrongName);
    return { aliases, fullName };
};

/** Birth and death dates, by official id, to keep trips within a life (and adulthood). */
const lifetimesOf = (
    drafts: readonly OfficialDraft[],
    ids: ReadonlyMap<OfficialDraft, string>,
    people: ReadonlyMap<string, WikidataEntity>
): Map<string, Lifetime> => {
    const lifetimes = new Map<string, Lifetime>();
    for (const draft of drafts) {
        const person = draft.wikidataId ? people.get(draft.wikidataId) : undefined;
        const id = ids.get(draft);
        if (person && id) {
            lifetimes.set(id, {
                born: snakDate(claimsOf(person, PROPERTY.birth)[0]?.mainsnak),
                died: snakDate(claimsOf(person, PROPERTY.death)[0]?.mainsnak),
            });
        }
    }
    return lifetimes;
};

/** When a person was born and died, as far as Wikidata knows. */
export interface Lifetime {
    born: IsoDate | null;
    died: IsoDate | null;
}

/** Trips before this age aren't an official's own (a namesake's, or a mismatch). */
const ADULT_AGE_YEARS = 15;

/**
 * Whether a trip falls within its traveller's life: not after their death, nor in childhood.
 *
 * @param startDate - When the trip began.
 * @param lifetime - The traveller's birth and death, when known.
 * @returns `false` for a trip that can't be theirs.
 */
export const isWithinLifetime = (startDate: IsoDate, lifetime: Lifetime | undefined): boolean => {
    const { born, died } = lifetime ?? { born: null, died: null };
    const adult = born ? `${Number(born.slice(0, 4)) + ADULT_AGE_YEARS}${born.slice(4)}` : null;
    return !((died && startDate > died) || (adult && startDate < adult));
};

/** Current positions first (most senior first), then past ones from newest to oldest. */
export const comparePositions = (a: PositionDraft, b: PositionDraft): number => {
    const aCurrent = a.endDate === null && !a.undated;
    const bCurrent = b.endDate === null && !b.undated;
    if (aCurrent !== bCurrent) {
        return aCurrent ? -1 : 1;
    }
    if (aCurrent) {
        return positionRank(a) - positionRank(b) || a.title.localeCompare(b.title);
    }
    return (b.endDate ?? "").localeCompare(a.endDate ?? "") || a.title.localeCompare(b.title);
};

/** A position without its country when that is the official's own (the stored form). */
const atHome = (position: PositionDraft, draft: OfficialDraft): PositionDraft => {
    if (position.countryCode !== draft.countryCode) {
        return position;
    }
    const { countryCode: _own, ...rest } = position;
    return rest;
};

/**
 * Like `comparePositions`, but offices of the official's own country come before current offices
 * abroad, so Charles III reads as Monarch of the United Kingdom rather than of Antigua.
 */
const compareHomeFirst = (a: PositionDraft, b: PositionDraft): number => {
    const isAbroad = (position: PositionDraft): number =>
        Number(
            position.endDate === null && !position.undated && position.countryCode !== undefined
        );
    return isAbroad(a) - isAbroad(b) || comparePositions(a, b);
};

/**
 * A draft's positions as stored: each term once, current ones first, with ids, and a country
 * only on offices of another country than the official's.
 *
 * @param draft - Official or person.
 * @param id - Their id, which the position ids extend.
 * @returns The positions.
 */
export const storedPositions = (
    draft: OfficialDraft,
    id: string
): (PositionDraft & { id: string })[] =>
    uniquePositions(draft.positions.map((position) => atHome(position, draft)))
        .sort(compareHomeFirst)
        .map((position, index) => ({ ...position, id: `${id}-p${index + 1}` }));

/**
 * Photos for people Wikidata has none for: the free lead image of their article on the first
 * Wikipedia (in `PHOTO_LANGUAGES` order) that has one.
 *
 * @param people - Wikidata items, with their article titles.
 * @returns File name per person's item id.
 */
const leadImages = async (
    people: ReadonlyMap<string, WikidataEntity>
): Promise<Map<string, string>> => {
    const found = new Map<string, string>();
    const missing = [...people.values()].filter(
        (person) => !snakString(claimsOf(person, PROPERTY.image)[0]?.mainsnak)
    );
    for (const language of PHOTO_LANGUAGES) {
        const titled = missing.flatMap((person) => {
            const title = person.wikiTitles[`${language}wiki`];
            return title && !found.has(person.id) ? [{ id: person.id, title }] : [];
        });
        if (titled.length === 0) {
            continue;
        }
        // A Wikipedia that fails only costs its photos, never the run.
        // biome-ignore lint/performance/noAwaitInLoops: languages are tried in order of preference.
        const images = await fetchPageImages(
            titled.map(({ title }) => title),
            language
        ).catch((error: unknown) => {
            log.warn(
                `Lead images from ${language}.wikipedia.org failed: ${(error as Error).message}`
            );
            return new Map<string, string>();
        });
        for (const { id, title } of titled) {
            const image = images.get(title);
            if (image) {
                found.set(id, image);
            }
        }
    }
    return found;
};

/**
 * Photos for people with neither a Wikidata image nor a Wikipedia lead image: one from their
 * Commons category whose file name names them, else their official parliamentary portrait.
 *
 * @param people - Wikidata items.
 * @param leadImageIds - People who already have a lead image.
 * @returns Photo address per person's item id.
 */
const otherPhotos = async (
    people: ReadonlyMap<string, WikidataEntity>,
    leadImageIds: ReadonlySet<string>
): Promise<Map<string, string>> => {
    const found = new Map<string, string>();
    const missing = [...people.values()].filter(
        (person) =>
            !(
                snakString(claimsOf(person, PROPERTY.image)[0]?.mainsnak) ||
                leadImageIds.has(person.id)
            )
    );
    for (const person of missing) {
        const category = snakString(claimsOf(person, PROPERTY.commonsCategory)[0]?.mainsnak);
        const file =
            category && person.label
                ? // biome-ignore lint/performance/noAwaitInLoops: Commons is asked one category at a time.
                  await categoryPortrait(category, person.label).catch(() => null)
                : null;
        const portrait = parliamentPortrait({
            ukParliament: snakString(claimsOf(person, UK_PARLIAMENT_ID)[0]?.mainsnak),
            usCongress: snakString(claimsOf(person, US_CONGRESS_ID)[0]?.mainsnak),
        });
        const photo = file ? commonsImageUrl(file, PHOTO_WIDTH) : portrait;
        if (photo) {
            found.set(person.id, photo);
        }
    }
    return found;
};

const officialRank = (official: GeneratedOfficial): number =>
    Math.min(...official.positions[0].categories.map((category) => ROLE_RANK[category]));

/**
 * Adds names, photos, parties, summaries and ids, producing the stored records.
 *
 * @param drafts - Assembled drafts.
 * @param previous - Officials and people from earlier runs, for stable ids.
 * @param reserved - Ids held by officials this run doesn't touch (other countries).
 * @returns Officials (with the id each draft received) sorted by country, seniority and name.
 */
export const enrichOfficials = async (
    drafts: OfficialDraft[],
    previous: readonly IdRecord[],
    reserved: ReadonlySet<string> = new Set()
): Promise<{
    idOf: Map<OfficialDraft, string>;
    lifetimes: Map<string, Lifetime>;
    officials: WarehouseOfficial[];
}> => {
    const people = await fetchEntities(
        drafts.flatMap((draft) => draft.wikidataId ?? []),
        ["labels", "aliases", "descriptions", "claims", "sitelinks"],
        PHOTO_LANGUAGES.map((language) => `${language}wiki`)
    );
    const pageImages = await leadImages(people);
    const morePhotos = await otherPhotos(people, new Set(pageImages.keys()));
    await fillStartDates(drafts, people);

    const partyIds = [...people.values()].flatMap((person) => partyIdOf(person) ?? []);
    const parties = await fetchEntities(partyIds, ["labels"]);
    const intros = await fetchIntros(
        [...people.values()].flatMap((person) => person.enwikiTitle ?? [])
    );
    const ids = assignIds(drafts, previous, reserved);
    // People Wikidata names in no English label: a name in Latin letters from any language.
    const unlabelled = [...people.values()]
        .filter((person) => !person.label)
        .map((person) => person.id);
    const otherLabels = await fetchAllLabels(unlabelled);

    const officials = drafts.map((draft): WarehouseOfficial => {
        const id = ids.get(draft) ?? slugify(draft.name);
        const person = draft.wikidataId ? people.get(draft.wikidataId) : undefined;
        const photo = person
            ? (snakString(claimsOf(person, PROPERTY.image)[0]?.mainsnak) ??
              pageImages.get(person.id))
            : null;
        const partyId = person ? partyIdOf(person) : null;
        const sources = [...draft.sources];
        if (person?.enwikiTitle) {
            sources.push({ label: "Wikipedia", url: wikipediaUrl(person.enwikiTitle) });
        }

        const { aliases, fullName } = namesOf(draft, person, otherLabels);
        return {
            aliases: aliases.filter((alias) => alias !== fullName).sort(),
            countryCode: draft.countryCode,
            fullName,
            id,
            party: partyId ? (parties.get(partyId)?.label ?? null) : null,
            photoUrl: photo
                ? commonsImageUrl(photo, PHOTO_WIDTH)
                : ((person && morePhotos.get(person.id)) ?? null),
            positions: storedPositions(draft, id),
            sources,
            summary: summaryFor(
                person?.enwikiTitle ? intros.get(person.enwikiTitle) : undefined,
                person
            ),
            wikidataId: draft.wikidataId,
        };
    });

    officials.sort(
        (a, b) =>
            a.countryCode.localeCompare(b.countryCode) ||
            officialRank(a) - officialRank(b) ||
            a.fullName.localeCompare(b.fullName) ||
            a.id.localeCompare(b.id)
    );
    return { idOf: ids, lifetimes: lifetimesOf(drafts, ids, people), officials };
};

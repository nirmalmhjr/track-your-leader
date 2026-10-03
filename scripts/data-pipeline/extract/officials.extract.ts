import { ROLE_RANK } from "@/features/travel-explorer/constants/explorer.constants";
import type { GeneratedOfficial } from "@/features/travel-explorer/data/generated-data.schema";
import type { SourceRef } from "@/features/travel-explorer/types/travel.types";
import type { CountryCode } from "@/types/geo.types";

import { capitalize, cleanText, normalizeName, slugify, stripParenthetical } from "../lib/text";
import {
    claimsOf,
    commonsImageUrl,
    fetchEntities,
    PROPERTY,
    qualifier,
    snakDate,
    snakItem,
    snakString,
    type WikidataEntity,
} from "../sources/wikidata";
import { fetchIntros, wikipediaUrl } from "../sources/wikipedia";
import type { OfficialDraft, PositionDraft } from "../types";
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

/**
 * Gives each official a readable id ("narendra-modi") that stays the same between runs, so
 * shared links keep working even if a name's spelling changes on Wikidata.
 */
const assignIds = (
    drafts: readonly OfficialDraft[],
    previous: readonly GeneratedOfficial[]
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
    const used = new Set<string>();
    const ordered = [...drafts].sort((a, b) =>
        (a.wikidataId ?? a.name).localeCompare(b.wikidataId ?? b.name)
    );
    for (const draft of ordered) {
        const remembered =
            (draft.wikidataId && previousByWikidata.get(draft.wikidataId)) ||
            previousByName.get(rosterKey(draft.countryCode, draft.name));
        const base = slugify(draft.name);
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

/** Current positions first (most senior first), then past ones from newest to oldest. */
const comparePositions = (a: PositionDraft, b: PositionDraft): number => {
    const aCurrent = a.endDate === null;
    const bCurrent = b.endDate === null;
    if (aCurrent !== bCurrent) {
        return aCurrent ? -1 : 1;
    }
    if (aCurrent) {
        return positionRank(a) - positionRank(b) || a.title.localeCompare(b.title);
    }
    return (b.endDate ?? "").localeCompare(a.endDate ?? "") || a.title.localeCompare(b.title);
};

const officialRank = (official: GeneratedOfficial): number =>
    Math.min(...official.positions[0].categories.map((category) => ROLE_RANK[category]));

/**
 * Adds names, photos, parties, summaries and ids, producing the records the app reads.
 *
 * @param drafts - Assembled drafts.
 * @param previous - Officials from the last run, for stable ids.
 * @returns Officials sorted by country, seniority and name.
 */
export const enrichOfficials = async (
    drafts: OfficialDraft[],
    previous: readonly GeneratedOfficial[]
): Promise<GeneratedOfficial[]> => {
    const people = await fetchEntities(
        drafts.flatMap((draft) => draft.wikidataId ?? []),
        ["labels", "descriptions", "claims", "sitelinks"]
    );
    await fillStartDates(drafts, people);

    const partyIds = [...people.values()].flatMap((person) => partyIdOf(person) ?? []);
    const parties = await fetchEntities(partyIds, ["labels"]);
    const intros = await fetchIntros(
        [...people.values()].flatMap((person) => person.enwikiTitle ?? [])
    );
    const ids = assignIds(drafts, previous);

    const officials = drafts.map((draft): GeneratedOfficial => {
        const id = ids.get(draft) ?? slugify(draft.name);
        const person = draft.wikidataId ? people.get(draft.wikidataId) : undefined;
        const photo = person ? snakString(claimsOf(person, PROPERTY.image)[0]?.mainsnak) : null;
        const partyId = person ? partyIdOf(person) : null;
        const sources = [...draft.sources];
        if (person?.enwikiTitle) {
            sources.push({ label: "Wikipedia", url: wikipediaUrl(person.enwikiTitle) });
        }

        return {
            countryCode: draft.countryCode,
            fullName: stripParenthetical(person?.label ?? draft.name),
            id,
            party: partyId ? (parties.get(partyId)?.label ?? null) : null,
            photoUrl: photo ? commonsImageUrl(photo, PHOTO_WIDTH) : null,
            positions: [...draft.positions].sort(comparePositions).map((position, index) => ({
                ...position,
                id: `${id}-p${index + 1}`,
            })),
            sources,
            summary: summaryFor(
                person?.enwikiTitle ? intros.get(person.enwikiTitle) : undefined,
                person
            ),
            wikidataId: draft.wikidataId,
        };
    });

    return officials.sort(
        (a, b) =>
            a.countryCode.localeCompare(b.countryCode) ||
            officialRank(a) - officialRank(b) ||
            a.fullName.localeCompare(b.fullName)
    );
};

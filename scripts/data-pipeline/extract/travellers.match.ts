import type { IsoDate } from "@/features/travel-explorer/types/travel.types";
import type { CountryCode } from "@/types/geo.types";

import { chunk, groupBy } from "../lib/collections";
import { addDaysIso } from "../lib/dates";
import { log } from "../lib/log";
import { normalizeName } from "../lib/text";
import { findPeopleByExactName } from "../sources/wikidata";
import type { CountryContext, OfficialDraft, PositionDraft, TripClaim } from "../types";

/**
 * Decides who made each trip. Sources identify travellers in different ways (a Wikidata id, a
 * full name, a family name and office, or only the office), so each claim is tried against the
 * known officials from the most to the least specific hint. A named traveller nobody matches
 * becomes a new official, described by what the sources say about them.
 */

/** Leeway around a term when checking an office holder was in office during a trip. */
const TERM_GRACE_DAYS = 45;
/** A newly discovered official whose last trip is this recent is assumed to be still in office. */
const STILL_IN_OFFICE_DAYS = 365;
const NAME_BATCH_SIZE = 50;
const MINIMUM_SHARED_TOKENS = 2;

const tokensOf = (name: string): Set<string> =>
    new Set(normalizeName(name).split(" ").filter(Boolean));

/** Same rule as `isSameName`, on pre-split names: every word of the shorter name appears. */
const sameTokens = (a: ReadonlySet<string>, b: ReadonlySet<string>): boolean => {
    const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
    if (smaller.size === 0) {
        return false;
    }
    const shared = [...smaller].filter((token) => larger.has(token)).length;
    return shared === smaller.size && (smaller.size >= MINIMUM_SHARED_TOKENS || larger.size === 1);
};

const heldOn = (position: PositionDraft, date: IsoDate): boolean =>
    (position.startDate === null || position.startDate <= addDaysIso(date, TERM_GRACE_DAYS)) &&
    (position.endDate === null || position.endDate >= addDaysIso(date, -TERM_GRACE_DAYS));

/** Whether a position fits the role a source describes (any shared category, same portfolio). */
const fitsRole = (position: PositionDraft, claim: TripClaim): boolean => {
    const { categories, portfolio } = claim.traveller;
    const sharesCategory = categories.some((category) => position.categories.includes(category));
    return portfolio ? sharesCategory && position.portfolio === portfolio : sharesCategory;
};

interface IndexedDraft {
    draft: OfficialDraft;
    names: Set<string>[];
    tokens: Set<string>;
}

/** Officials by country, with their names pre-split for fast comparison. */
class DraftIndex {
    private readonly byCountry = new Map<CountryCode, IndexedDraft[]>();
    private readonly byWikidata = new Map<string, OfficialDraft>();
    private readonly nameCache = new Map<string, IndexedDraft[]>();

    add(draft: OfficialDraft): void {
        const names = [draft.name, ...draft.aliases].map(tokensOf);
        const entry = { draft, names, tokens: new Set(names.flatMap((name) => [...name])) };
        const list = this.byCountry.get(draft.countryCode);
        if (list) {
            list.push(entry);
        } else {
            this.byCountry.set(draft.countryCode, [entry]);
        }
        if (draft.wikidataId) {
            this.byWikidata.set(draft.wikidataId, draft);
        }
        this.nameCache.clear();
    }

    byId(id: string): OfficialDraft | undefined {
        return this.byWikidata.get(id);
    }

    named(code: CountryCode, name: string): IndexedDraft[] {
        const key = `${code}|${normalizeName(name)}`;
        const cached = this.nameCache.get(key);
        if (cached) {
            return cached;
        }
        const wanted = tokensOf(name);
        const found = (this.byCountry.get(code) ?? []).filter((entry) =>
            entry.names.some((names) => sameTokens(names, wanted))
        );
        this.nameCache.set(key, found);
        return found;
    }

    inCountry(code: CountryCode): IndexedDraft[] {
        return this.byCountry.get(code) ?? [];
    }
}

/** Among candidates, the single one who held a fitting office on the trip's date. */
const pickInOffice = (
    candidates: readonly IndexedDraft[],
    claim: TripClaim,
    requireRole: boolean
): OfficialDraft | null => {
    const inOffice = candidates.filter(({ draft }) =>
        draft.positions.some(
            (position) =>
                heldOn(position, claim.startDate) && (!requireRole || fitsRole(position, claim))
        )
    );
    return inOffice.length === 1 ? inOffice[0].draft : null;
};

const findTraveller = (claim: TripClaim, index: DraftIndex): OfficialDraft | null => {
    const { countryCode, familyName, name, wikidataId } = claim.traveller;
    const byId = wikidataId ? index.byId(wikidataId) : undefined;
    if (byId) {
        return byId;
    }
    if (name) {
        const named = index.named(countryCode, name);
        if (named.length === 1) {
            return named[0].draft;
        }
        const resolved = named.length > 1 ? pickInOffice(named, claim, false) : null;
        if (resolved) {
            return resolved;
        }
    }
    if (familyName) {
        const family = normalizeName(familyName).split(" ").filter(Boolean);
        const candidates = index
            .inCountry(countryCode)
            .filter(
                (entry) => family.length > 0 && family.every((token) => entry.tokens.has(token))
            );
        const resolved = pickInOffice(candidates, claim, true);
        if (resolved) {
            return resolved;
        }
    }
    if (!name && claim.traveller.categories.length > 0) {
        return pickInOffice(index.inCountry(countryCode), claim, true);
    }
    return null;
};

/** Describes a newly discovered official from the trips sources attribute to them. */
const draftFromClaims = (claims: readonly TripClaim[], today: IsoDate): OfficialDraft => {
    const [first] = claims;
    const byTitle = groupBy(claims, (claim) => claim.traveller.title ?? "");
    const positions = [...byTitle].map(([title, group]): PositionDraft => {
        const starts = group.map((claim) => claim.startDate).sort();
        const lastEnd =
            group
                .map((claim) => claim.endDate)
                .sort()
                .at(-1) ?? starts[0];
        const isRecent = lastEnd >= addDaysIso(today, -STILL_IN_OFFICE_DAYS);
        const [sample] = group;
        return {
            categories:
                sample.traveller.categories.length > 0
                    ? sample.traveller.categories
                    : ["senior_official"],
            endDate: isRecent ? null : lastEnd,
            ministry: null,
            portfolio: sample.traveller.portfolio,
            startDate: starts[0],
            title: title || "Official",
        };
    });
    return {
        aliases: [],
        countryCode: first.traveller.countryCode,
        name: first.traveller.name ?? "",
        positions,
        sources: [
            ...new Map(claims.map((claim) => [claim.sourceRef.url, claim.sourceRef])).values(),
        ],
        wikidataId: null,
    };
};

/** Looks discovered officials up on Wikidata by exact name, so they gain photos and biographies. */
const identifyNewDrafts = async (
    drafts: readonly OfficialDraft[],
    contexts: ReadonlyMap<CountryCode, CountryContext>
): Promise<void> => {
    for (const [code, group] of groupBy(drafts, (draft) => draft.countryCode)) {
        const country = contexts.get(code);
        if (!country) {
            continue;
        }
        for (const batch of chunk(group, NAME_BATCH_SIZE)) {
            // biome-ignore lint/performance/noAwaitInLoops: one query at a time keeps the query service happy.
            const matches = await findPeopleByExactName(
                batch.map((draft) => draft.name),
                country.wikidataId
            );
            for (const draft of batch) {
                const people = matches.get(draft.name) ?? [];
                draft.wikidataId = people.length === 1 ? people[0] : null;
            }
        }
    }
};

export interface TravellerMatches {
    /** The official each claim belongs to. */
    draftOf: Map<TripClaim, OfficialDraft>;
    /** Officials introduced by trip sources. */
    newDrafts: OfficialDraft[];
    /** Claims naming only an office whose holder isn't known. */
    unmatched: TripClaim[];
}

/**
 * Assigns every claim to an official, creating officials for named travellers nobody matches.
 *
 * @param claims - Claims from every source.
 * @param drafts - Known officials.
 * @param contexts - Country contexts, for Wikidata lookups of new officials.
 * @param today - Run date.
 * @returns The assignment, new officials and claims left without a traveller.
 */
export const matchTravellers = async (
    claims: readonly TripClaim[],
    drafts: readonly OfficialDraft[],
    contexts: ReadonlyMap<CountryCode, CountryContext>,
    today: IsoDate
): Promise<TravellerMatches> => {
    const index = new DraftIndex();
    for (const draft of drafts) {
        index.add(draft);
    }

    const draftOf = new Map<TripClaim, OfficialDraft>();
    const strangers = new Map<string, TripClaim[]>();
    const unmatched: TripClaim[] = [];
    for (const claim of claims) {
        const draft = findTraveller(claim, index);
        if (draft) {
            draftOf.set(claim, draft);
        } else if (claim.traveller.name) {
            const key = `${claim.traveller.countryCode}|${normalizeName(claim.traveller.name)}`;
            strangers.set(key, [...(strangers.get(key) ?? []), claim]);
        } else {
            unmatched.push(claim);
        }
    }

    const candidates = [...strangers.values()].map((group) => ({
        draft: draftFromClaims(group, today),
        group,
    }));
    log.info(`${candidates.length} travellers not yet known; looking them up on Wikidata`);
    await identifyNewDrafts(
        candidates.map(({ draft }) => draft),
        contexts
    );

    const newDrafts: OfficialDraft[] = [];
    for (const { draft, group } of candidates) {
        // A Wikidata match may reveal someone already known under another spelling.
        const known = draft.wikidataId ? index.byId(draft.wikidataId) : undefined;
        const owner = known ?? draft;
        if (!known) {
            newDrafts.push(draft);
            index.add(draft);
        }
        for (const claim of group) {
            draftOf.set(claim, owner);
        }
    }
    return { draftOf, newDrafts, unmatched };
};

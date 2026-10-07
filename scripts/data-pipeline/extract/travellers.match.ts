import type { CountryCode } from "@/types/geo.types";
import type { IsoDate, RoleCategory } from "@/types/travel.types";

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
const LEADER_ROLES: ReadonlySet<RoleCategory> = new Set(["head_of_state", "head_of_government"]);

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

/** Undated positions can't place anyone in office on a given day. */
const heldOn = (position: PositionDraft, date: IsoDate, graceDays = TERM_GRACE_DAYS): boolean =>
    !position.undated &&
    (position.startDate === null || position.startDate <= addDaysIso(date, graceDays)) &&
    (position.endDate === null || position.endDate >= addDaysIso(date, -graceDays));

/** End dates after this are data errors, not terms still to come. */
const LATEST_PLAUSIBLE_END = "2100-01-01";

/** Whether a term's dates can be trusted: a known start, and an end that can be true. */
const isWellDated = (position: PositionDraft): boolean =>
    position.startDate !== null &&
    (position.endDate === null || position.endDate < LATEST_PLAUSIBLE_END);

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

/**
 * Among candidates, the single one who held a fitting office on the trip's date. Terms get some
 * leeway, so right after a change of government both holders fit; then exact terms decide.
 */
const pickInOffice = (
    candidates: readonly IndexedDraft[],
    claim: TripClaim,
    requireRole: boolean
): OfficialDraft | null => {
    const holders = (graceDays: number) =>
        candidates.filter(({ draft }) =>
            draft.positions.some(
                (position) =>
                    heldOn(position, claim.startDate, graceDays) &&
                    (!requireRole || fitsRole(position, claim))
            )
        );
    const withGrace = holders(TERM_GRACE_DAYS);
    const inOffice = withGrace.length > 1 ? holders(0) : withGrace;
    if (inOffice.length <= 1) {
        return inOffice[0]?.draft ?? null;
    }
    // A term with no start (a current cabinet member's) or an impossible end (Wikidata's
    // Deputy Prime Minister "until 6767") seems to cover every date; one known to cover the
    // trip's date is more credible.
    const welldated = inOffice.filter(({ draft }) =>
        draft.positions.some(
            (position) =>
                isWellDated(position) &&
                heldOn(position, claim.startDate, 0) &&
                (!requireRole || fitsRole(position, claim))
        )
    );
    return welldated.length === 1 ? welldated[0].draft : null;
};

/**
 * A source naming a leader by surname alone ("President Betancourt"), on a date Wikidata has no
 * term for: the single official of that country with that surname who held the role at some
 * point. Several (two Gandhis) means no match.
 */
const findBySurname = (name: string, claim: TripClaim, index: DraftIndex): OfficialDraft | null => {
    const [surname, ...rest] = tokensOf(name);
    if (!surname || rest.length > 0 || claim.traveller.categories.length === 0) {
        return null;
    }
    const candidates = index
        .inCountry(claim.traveller.countryCode)
        .filter(
            ({ draft, tokens }) =>
                tokens.has(surname) && draft.positions.some((position) => fitsRole(position, claim))
        );
    return candidates.length === 1 ? candidates[0].draft : null;
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
    // A country has one head of state and one head of government at a time, so the office also
    // identifies a named leader whose name is spelled differently ("Salih" for "Saleh"). A
    // source that names a family name nobody holds ("Mr G. Pokharel, Minister of Health") is
    // left unmatched rather than given to whoever held the office.
    const isLeader = claim.traveller.categories.some((category) => LEADER_ROLES.has(category));
    const namesNoOne = !(name || familyName);
    if ((namesNoOne || isLeader) && claim.traveller.categories.length > 0) {
        const holder = pickInOffice(index.inCountry(countryCode), claim, true);
        if (holder) {
            return holder;
        }
    }
    return name ? findBySurname(name, claim, index) : null;
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

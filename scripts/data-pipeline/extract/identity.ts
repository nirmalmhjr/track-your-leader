import type { CountryCode } from "@/types/geo.types";
import type { IsoDate } from "@/types/travel.types";

import { PIPELINE_CONFIG } from "../config";
import { groupBy } from "../lib/collections";
import { addDaysIso } from "../lib/dates";
import { log } from "../lib/log";
import { isSameName } from "../lib/text";
import { fetchEntities, findPeopleByExactName, searchPeople } from "../sources/wikidata";
import type { CountryContext, OfficialDraft } from "../types";
import type { Roster, RosterMember } from "./roster";

/**
 * Wikidata's search API is rate-limited, so each run searches at most this many names; the
 * rest wait for the next run (the roster remembers who has been looked up).
 */
/** Searches per run; each name is searched again only after `identityRetryDays`. */
const MAX_SEARCHES_PER_RUN = 2500;
/** Titles cabinet lists put before names ("Bishop Juan Edghill", "Dr. Ahmed …", "Gen. …"). */
const LEADING_TITLES =
    /^(?:(?:dr|prof|gen|lt|col|maj|adm|brig|cdr|capt|eng|engr|rev|bishop|sheikh|shaikh|sir|dame|hon|mr|mrs|ms|haji|hajji|alhaji|pastor|imam)\.?\s+)+/i;

interface IdentityInput {
    contexts: ReadonlyMap<CountryCode, CountryContext>;
    leaders: ReadonlyMap<string, OfficialDraft>;
    roster: Roster;
    today: IsoDate;
}

/**
 * Raised whenever the name search improves (2: leading titles dropped, more searches per run),
 * so everyone it missed before is looked up again at once rather than after the retry delay.
 */
const SEARCH_VERSION = 2;

const isDueForLookup = (member: RosterMember, today: IsoDate): boolean =>
    member.lookedUpOn === null ||
    (member.searchVersion ?? 1) < SEARCH_VERSION ||
    addDaysIso(member.lookedUpOn, PIPELINE_CONFIG.identityRetryDays) <= today;

/** "Ishiba Shigeru" is also tried as "Shigeru Ishiba" (family name first in some sources). */
/** The name without the titles a list put before it. */
const withoutTitles = (name: string): string => name.replace(LEADING_TITLES, "").trim() || name;

/** The spellings a name is looked up by: as listed, without titles, and family name first. */
const spellingsOf = (listed: string): string[] => {
    const name = withoutTitles(listed);
    const words = name.split(" ");
    const forms = words.length === 2 ? [name, `${words[1]} ${words[0]}`] : [name];
    return [...new Set([listed, ...forms])];
};

/** First pass: exact name or alias matches among the country's citizens, one query per country. */
const matchExactNames = async (
    members: readonly RosterMember[],
    contexts: ReadonlyMap<CountryCode, CountryContext>
): Promise<void> => {
    const groups = [...groupBy(members, (member) => member.countryCode)].flatMap(
        ([code, group]) => {
            const country = contexts.get(code);
            return country ? [{ country, group }] : [];
        }
    );
    const results = await Promise.all(
        groups.map(({ country, group }) =>
            findPeopleByExactName(
                group.flatMap((member) => spellingsOf(member.name)),
                country.wikidataId
            )
        )
    );
    for (const [index, { group }] of groups.entries()) {
        const matches = results[index];
        for (const member of group) {
            const people = new Set(
                spellingsOf(member.name).flatMap((spelling) => matches.get(spelling) ?? [])
            );
            // Two different people with the same name: leave it to search, don't guess.
            const [onlyMatch] = people;
            if (people.size === 1 && onlyMatch) {
                member.wikidataId = onlyMatch;
            }
        }
    }
};

/** Second pass: full-text search, tolerant of accents and spelling variants. */
const searchNames = async (
    members: readonly RosterMember[],
    contexts: ReadonlyMap<CountryCode, CountryContext>
): Promise<void> => {
    const candidateLists: string[][] = [];
    for (const member of members) {
        const country = contexts.get(member.countryCode);
        candidateLists.push(
            // biome-ignore lint/performance/noAwaitInLoops: Wikidata's search API rejects bursts, so names go one at a time.
            country ? await searchPeople(withoutTitles(member.name), country.wikidataId) : []
        );
    }
    const candidates = await fetchEntities(candidateLists.flat(), ["labels", "aliases"]);

    for (const [index, member] of members.entries()) {
        member.wikidataId =
            candidateLists[index].find((id) => {
                const entity = candidates.get(id);
                const names = [entity?.label, ...(entity?.aliases ?? [])].filter(
                    (name): name is string => Boolean(name)
                );
                return names.some((name) => isSameName(name, withoutTitles(member.name)));
            }) ?? null;
    }
};

/**
 * Links roster members to Wikidata people, which brings photos, parties, biographies and
 * trip-list pages. A match must agree on name and citizenship; anyone unmatched keeps the CIA
 * name and no photo, and is retried after `identityRetryDays`.
 *
 * @returns Names that could not be matched, for the run report.
 */
export const resolveIdentities = async ({
    contexts,
    leaders,
    roster,
    today,
}: IdentityInput): Promise<string[]> => {
    const pending: RosterMember[] = [];
    for (const member of Object.values(roster)) {
        if (member.wikidataId) {
            continue;
        }
        const leader = [...leaders.values()].find(
            (draft) =>
                draft.countryCode === member.countryCode && isSameName(draft.name, member.name)
        );
        if (leader?.wikidataId) {
            member.wikidataId = leader.wikidataId;
        } else if (isDueForLookup(member, today)) {
            pending.push(member);
        }
    }

    await matchExactNames(pending, contexts);
    const unmatched = pending.filter((member) => !member.wikidataId);
    const toSearch = unmatched.slice(0, MAX_SEARCHES_PER_RUN);
    log.info(
        `${pending.length - unmatched.length} matched by exact name; searching ${toSearch.length} of ${unmatched.length} others`
    );
    await searchNames(toSearch, contexts);

    for (const member of [...pending.filter((candidate) => candidate.wikidataId), ...toSearch]) {
        member.lookedUpOn = today;
        member.searchVersion = SEARCH_VERSION;
    }

    return Object.values(roster)
        .filter((member) => member.wikidataId === null)
        .map((member) => `${member.countryCode}: ${member.name}`)
        .sort();
};

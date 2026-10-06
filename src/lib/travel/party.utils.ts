import type { Official } from "@/types/travel.types";

/** Names up to this long read fine in a chip; longer ones are shortened to their initials. */
const MAX_FULL_PARTY_LENGTH = 20;
/** Fewer initials than this say nothing about the party, so the full name is kept. */
const MIN_ACRONYM_LENGTH = 2;
/** "Communist Party of Nepal (Unified Marxist–Leninist)": the name, then a faction in brackets. */
const FACTION_PATTERN = /^(.+?)\s*\((.+)\)$/;
const WORD_BREAK = /[\s–-]+/;
const CAPITALISED = /^\p{Lu}/u;

/** How many officials belong to one party; `party` is `null` for those with none recorded. */
export interface PartyCount {
    count: number;
    party: string | null;
}

const initialsOf = (text: string): string =>
    text
        .split(WORD_BREAK)
        .filter((word) => CAPITALISED.test(word))
        .map((word) => word.charAt(0))
        .join("");

/**
 * Shortens a long party name to its initials, keeping a faction in brackets, for chips and
 * other tight spaces. Short names are already readable and stay as they are.
 *
 * @param party - Full party name.
 * @returns "RSP" for "Rastriya Swatantra Party", "CPN (UML)" for "Communist Party of Nepal
 * (Unified Marxist–Leninist)", or the full name when it is short or has too few capitals.
 */
export const abbreviateParty = (party: string): string => {
    if (party.length <= MAX_FULL_PARTY_LENGTH) {
        return party;
    }
    const match = FACTION_PATTERN.exec(party);
    const name = initialsOf(match ? match[1] : party);
    if (name.length < MIN_ACRONYM_LENGTH) {
        return party;
    }
    const faction = match ? initialsOf(match[2]) : "";
    return faction ? `${name} (${faction})` : name;
};

/**
 * Counts officials by party.
 *
 * @param officials - Officials to count.
 * @returns One row per party, largest first then alphabetical, with officials whose party
 * isn't recorded last.
 */
export const countParties = (officials: readonly Official[]): PartyCount[] => {
    const counts = new Map<string | null, number>();
    for (const official of officials) {
        counts.set(official.party, (counts.get(official.party) ?? 0) + 1);
    }
    return [...counts]
        .map(([party, count]) => ({ count, party }))
        .sort(
            (a, b) =>
                Number(a.party === null) - Number(b.party === null) ||
                b.count - a.count ||
                (a.party ?? "").localeCompare(b.party ?? "")
        );
};

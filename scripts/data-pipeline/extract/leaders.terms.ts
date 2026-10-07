import type { IsoDate, RoleCategory } from "@/types/travel.types";

import type { PositionDraft } from "../types";

/**
 * Closes leader terms Wikidata leaves open after someone else took over. A country's own item
 * names its head of state and government ("Head of government: Phumtham Wechayachai, from July
 * 2025"); such a statement stays open when the office's next holder is recorded only on the
 * office ("Prime Minister of Thailand: Anutin Charnvirakul, from September 2025"), and the other
 * way round. Left open, both look current.
 */

const LEADER_CATEGORIES: readonly RoleCategory[] = ["head_of_state", "head_of_government"];
/** Offices several people hold at once (the Swiss Federal Council, San Marino's Captains Regent). */
const COLLECTIVE_TITLE = /\b(?:member|council|regents?|presidency|co-prince)\b/i;
/** Titles of the statements on a country's item, as opposed to a named office. */
const GENERIC_TITLE = /^head of (?:state|government)$/i;

interface Holder {
    positions: PositionDraft[];
}

interface Term {
    official: Holder;
    position: PositionDraft;
}

const isOpen = ({ position }: Term): boolean => position.endDate === null && !position.undated;

/**
 * Ends superseded terms of one country's heads of state and government, in place:
 * - an open generic term ends when someone else starts a later term in that category;
 * - an open named term for that category alone ends when someone else's generic term starts
 *   later, or someone else takes the same office. Offices that are both (a President who heads
 *   the government) are never ended so,
 *   since they can rightly run beside a Prime Minister or a Supreme Leader.
 *
 * @param officials - One country's officials (drafts, before their positions are sorted).
 * @returns How many terms were closed.
 */
export const closeSupersededLeaderTerms = (officials: readonly Holder[]): number => {
    let closed = 0;
    for (const category of LEADER_CATEGORIES) {
        const terms: Term[] = officials.flatMap((official) =>
            official.positions
                .filter((position) => position.categories.includes(category) && position.startDate)
                .map((position) => ({ official, position }))
        );
        for (const term of terms.filter(isOpen)) {
            const isGeneric = GENERIC_TITLE.test(term.position.title);
            const isSingleRole = term.position.categories.length === 1;
            if (!(isGeneric || isSingleRole)) {
                continue;
            }
            const start = term.position.startDate as IsoDate;
            const successors = terms
                .filter(
                    (other) =>
                        other.official !== term.official &&
                        (other.position.startDate ?? "") > start &&
                        (isGeneric ||
                            GENERIC_TITLE.test(other.position.title) ||
                            // The same office, taken over: Sudan's acting PM, then the next PM.
                            (other.position.title === term.position.title &&
                                !COLLECTIVE_TITLE.test(term.position.title)))
                )
                .map((other) => other.position.startDate as IsoDate)
                .sort();
            const [next] = successors;
            if (next) {
                term.position.endDate = next;
                closed += 1;
            }
        }
    }
    return closed;
};

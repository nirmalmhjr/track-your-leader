import type { CountryCode } from "@/types/geo.types";
import type { IsoDate, RoleCategory } from "@/types/travel.types";

import { TERRITORY_SOVEREIGNS } from "../config";
import { groupBy } from "../lib/collections";
import type { PositionDraft } from "../types";

/**
 * Closes leader terms Wikidata leaves open after someone else took over. A country's own item
 * names its head of state and government ("Head of government: Phumtham Wechayachai, from July
 * 2025"); such a statement stays open when the office's next holder is recorded only on the
 * office ("Prime Minister of Thailand: Anutin Charnvirakul, from September 2025"), and the other
 * way round. Left open, both look current.
 */

/** A governor-general's term ends when the next one takes over, like a head of state's. */
const LEADER_CATEGORIES: readonly RoleCategory[] = [
    "head_of_state",
    "head_of_government",
    "governor_general",
];
/** The bare title the CIA's cabinet lists give a governor-general, without the country. */
const BARE_GOVERNOR_GENERAL = /^governor[- ]general$/i;
/** Offices several people hold at once (the Swiss Federal Council, San Marino's Captains Regent). */
const COLLECTIVE_TITLE = /\b(?:member|council|regents?|presidency|co-prince)\b/i;
/** Titles of the statements on a country's item, as opposed to a named office. */
const GENERIC_TITLE = /^head of (?:state|government)$/i;

interface Holder {
    /** Absent in tests that hold a single country's officials. */
    countryCode?: CountryCode;
    positions: PositionDraft[];
}

interface Term {
    /** The country the office belongs to: terms only supersede terms of the same country. */
    country: CountryCode | undefined;
    official: Holder;
    position: PositionDraft;
}

const isOpen = ({ position }: Term): boolean => position.endDate === null && !position.undated;

/** Closes one country's superseded terms of one category; see `closeSupersededLeaderTerms`. */
const closeTermsOfOneCountry = (terms: readonly Term[]): number => {
    let closed = 0;
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
    return closed;
};

/**
 * Ends superseded terms of heads of state and government, in place, comparing each term only
 * with others of the same country (Charles III's "Monarch of Canada" with Canada's):
 * - an open generic term ends when someone else starts a later term in that category;
 * - an open named term for that category alone ends when someone else's generic term starts
 *   later, or someone else takes the same office. Offices that are both (a President who heads
 *   the government) are never ended so,
 *   since they can rightly run beside a Prime Minister or a Supreme Leader.
 *
 * @param officials - Officials (drafts, before their positions are sorted).
 * @returns How many terms were closed.
 */
export const closeSupersededLeaderTerms = (officials: readonly Holder[]): number => {
    let closed = 0;
    for (const category of LEADER_CATEGORIES) {
        const allTerms: Term[] = officials.flatMap((official) =>
            official.positions
                .filter((position) => position.categories.includes(category) && position.startDate)
                .map((position) => ({
                    country: position.countryCode ?? official.countryCode,
                    official,
                    position,
                }))
        );
        for (const terms of groupBy(allTerms, (term) => term.country ?? "").values()) {
            closed += closeTermsOfOneCountry(terms);
        }
    }
    return closed;
};

/** Whether two terms overlap; a missing date reaches as far as it can. */
const overlaps = (a: PositionDraft, b: PositionDraft): boolean =>
    (a.startDate ?? "") <= (b.endDate ?? "9999-12-31") &&
    (b.startDate ?? "") <= (a.endDate ?? "9999-12-31");

/**
 * Lists a monarch as head of state of the territories their country heads (Charles III of
 * Bermuda, as King of the United Kingdom): each of their terms as the country's head of state
 * is added again for the territory, unless a head-of-state term there already covers it.
 *
 * @param officials - Officials (drafts), changed in place.
 * @param sovereigns - Each territory, and the country whose monarch heads it.
 * @returns How many terms were added.
 */
export const addTerritoryMonarchs = (
    officials: readonly Holder[],
    sovereigns: Readonly<Record<CountryCode, CountryCode>> = TERRITORY_SOVEREIGNS
): number => {
    let added = 0;
    for (const official of officials) {
        const countryOf = (position: PositionDraft): CountryCode | undefined =>
            position.countryCode ?? official.countryCode;
        const isHeadOfStateIn = (position: PositionDraft, code: CountryCode): boolean =>
            countryOf(position) === code && position.categories.includes("head_of_state");
        for (const [territory, sovereign] of Object.entries(sovereigns)) {
            const reigns = official.positions.filter(
                (position) =>
                    isHeadOfStateIn(position, sovereign) && !GENERIC_TITLE.test(position.title)
            );
            for (const reign of reigns) {
                const isListed = official.positions.some(
                    (position) => isHeadOfStateIn(position, territory) && overlaps(position, reign)
                );
                if (!isListed) {
                    official.positions.push({ ...reign, countryCode: territory });
                    added += 1;
                }
            }
        }
    }
    return added;
};

/**
 * Drops the bare "Governor General" of a CIA cabinet list from someone whose term Wikidata
 * records as "Governor-General of …": the CIA dates it from when the list was read, and may list
 * a governor-general who has since left (Canada's, in 2026), so it would keep them in office.
 *
 * @param officials - Officials (drafts), changed in place.
 * @returns How many positions were dropped.
 */
export const dropBareGovernorGeneral = (officials: readonly Holder[]): number => {
    let dropped = 0;
    for (const official of officials) {
        const isGovernorGeneral = (position: PositionDraft): boolean =>
            position.categories.includes("governor_general");
        const hasNamedTerm = official.positions.some(
            (position) => isGovernorGeneral(position) && !BARE_GOVERNOR_GENERAL.test(position.title)
        );
        if (!hasNamedTerm) {
            continue;
        }
        const kept = official.positions.filter(
            (position) =>
                !(isGovernorGeneral(position) && BARE_GOVERNOR_GENERAL.test(position.title))
        );
        dropped += official.positions.length - kept.length;
        official.positions.splice(0, official.positions.length, ...kept);
    }
    return dropped;
};

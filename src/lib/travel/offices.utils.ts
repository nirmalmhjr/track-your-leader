import { getCategoryGroup, getCurrentPosition } from "@/lib/travel/officials.utils";
import { OFFICE_GROUPS, PORTFOLIOS, ROLE_RANK } from "@/lib/travel/travel.constants";
import { normalizeSearchText } from "@/lib/utils";
import type { OfficeGroup, Official, Position } from "@/types/travel.types";

/** One stint of one official in an office. */
export interface OfficeTerm {
    official: Official;
    position: Position;
}

/** A government office and everyone tracked as holding it, newest first. */
export interface Office {
    /** Terms of the officials holding the office now. */
    current: OfficeTerm[];
    group: OfficeGroup;
    /** Distinct officials who held the office, a person serving twice counting once. */
    holderCount: number;
    key: string;
    /** Earlier terms, most recently ended first. */
    past: OfficeTerm[];
    title: string;
}

/** Officials of a country split by whether they hold an office today. */
export interface TenureBreakdown {
    current: number;
    former: number;
}

const groupIndex = (group: OfficeGroup): number => OFFICE_GROUPS.indexOf(group);

const seniority = (position: Position): number =>
    Math.min(...position.categories.map((category) => ROLE_RANK[category]));

const portfolioIndex = (position: Position): number =>
    position.portfolio === null ? PORTFOLIOS.length : PORTFOLIOS.indexOf(position.portfolio);

/** Latest end first; open-ended or undated stints sort by their start instead. */
const compareTerms = (a: OfficeTerm, b: OfficeTerm): number =>
    (b.position.endDate ?? "").localeCompare(a.position.endDate ?? "") ||
    (b.position.startDate ?? "").localeCompare(a.position.startDate ?? "");

const compareOffices = (a: Office, b: Office): number => {
    const first = (a.current[0] ?? a.past[0]).position;
    const second = (b.current[0] ?? b.past[0]).position;
    return (
        groupIndex(a.group) - groupIndex(b.group) ||
        seniority(first) - seniority(second) ||
        portfolioIndex(first) - portfolioIndex(second) ||
        a.title.localeCompare(b.title)
    );
};

/**
 * Counts how many officials hold an office today and how many only held one in the past.
 *
 * @param officials - Officials to count.
 * @returns Current and former office holders.
 */
export const countTenure = (officials: readonly Official[]): TenureBreakdown => {
    const current = officials.filter((official) => getCurrentPosition(official) !== null).length;
    return { current, former: officials.length - current };
};

/** Office key for a position: its title, ignoring case and accents. */
const officeKey = (position: Position): string => normalizeSearchText(position.title);

/**
 * Keys of the offices someone holds today.
 *
 * @param officials - Officials of one country, unfiltered so filtered-out holders still count.
 * @returns Keys comparable with `Office.key`.
 */
export const getHeldOfficeKeys = (officials: readonly Official[]): Set<string> =>
    new Set(
        officials.flatMap((official) =>
            official.positions
                .filter((position) => position.endDate === null)
                .map((position) => officeKey(position))
        )
    );

/**
 * Regroups officials by the offices they held, so a country reads as a list of positions with
 * their current and earlier holders. Titles are matched case- and accent-insensitively.
 *
 * @param officials - Officials of one country.
 * @param heldKeys - Offices to treat as held even when none of `officials` holds them now
 *   (their holder may be filtered out); defaults to the offices `officials` hold.
 * @returns Offices ordered by group, seniority, portfolio and title.
 */
export const groupOffices = (
    officials: readonly Official[],
    heldKeys: ReadonlySet<string> = getHeldOfficeKeys(officials)
): Office[] => {
    const termsByKey = new Map<string, OfficeTerm[]>();
    for (const official of officials) {
        for (const position of official.positions) {
            const key = officeKey(position);
            const terms = termsByKey.get(key);
            if (terms) {
                terms.push({ official, position });
            } else {
                termsByKey.set(key, [{ official, position }]);
            }
        }
    }

    const offices: Office[] = [];
    for (const [key, terms] of termsByKey) {
        const sorted = terms.toSorted(compareTerms);
        const current = sorted.filter((term) => term.position.endDate === null);
        const past = sorted.filter((term) => term.position.endDate !== null);
        const latest = current[0] ?? past[0];
        offices.push({
            current,
            group: heldKeys.has(key) ? getCategoryGroup(latest.position.categories) : "vacant",
            holderCount: new Set(terms.map((term) => term.official.id)).size,
            key,
            past,
            title: latest.position.title,
        });
    }

    return offices.sort(compareOffices);
};

/** Earlier terms that ended in one calendar year. */
export interface YearTerms {
    terms: OfficeTerm[];
    year: string;
}

/**
 * Lays out the past year by year: every finished term, grouped by the year it ended.
 *
 * @param officials - Officials of one country.
 * @returns Years from most recent, each with its terms ordered by latest end date first.
 */
export const groupPastTermsByYear = (officials: readonly Official[]): YearTerms[] => {
    const terms = officials
        .flatMap((official) => official.positions.map((position) => ({ official, position })))
        .filter((term) => term.position.endDate !== null)
        .sort(compareTerms);

    const years: YearTerms[] = [];
    for (const term of terms) {
        const year = (term.position.endDate ?? "").slice(0, 4);
        const last = years.at(-1);
        if (last?.year === year) {
            last.terms.push(term);
        } else {
            years.push({ terms: [term], year });
        }
    }
    return years;
};

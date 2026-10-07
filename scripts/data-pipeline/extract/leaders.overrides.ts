import type { CountryCode } from "@/types/geo.types";
import type { IsoDate } from "@/types/travel.types";

/** A head of state or government term that Wikidata doesn't record. */
export interface LeaderTermOverride {
    code: CountryCode;
    endDate: IsoDate | null;
    kind: "hog" | "hos";
    /** The leader's Wikidata item, which still supplies the name, photo and biography. */
    personId: string;
    /** Where the dates come from. */
    source: string;
    startDate: IsoDate;
    /** Office title, so the term sits with the office's other holders. */
    title: string;
}

/**
 * Leader terms missing from Wikidata: the person has an item but no "position held" statement
 * for the office, so no query finds them and trip sources that name them create a bare stub
 * ("Koirala") instead. `data/warehouse/report.json` lists officials without a Wikidata match
 * after every run; add an entry here when one of them is a head of state or government.
 * Remove an entry once Wikidata records the term.
 */
export const LEADER_TERM_OVERRIDES: readonly LeaderTermOverride[] = [
    // B. P. Koirala, Nepal's first elected prime minister, dismissed by King Mahendra.
    {
        code: "NPL",
        endDate: "1960-12-15",
        kind: "hog",
        personId: "Q560515",
        source: "https://en.wikipedia.org/wiki/List_of_prime_ministers_of_Nepal",
        startDate: "1959-05-27",
        title: "Prime Minister of Nepal",
    },
];

/** An office Wikidata wrongly says someone held. */
export interface PositionExclusion {
    /** The person's Wikidata item. */
    personId: string;
    /** Why the statement is wrong. */
    reason: string;
    /** Office title as stored. */
    title: string;
}

/**
 * Wrong "position held" statements on Wikidata, left out of every record. Better still, fix the
 * statement on Wikidata and remove the entry.
 */
export const POSITION_EXCLUSIONS: readonly PositionExclusion[] = [
    {
        personId: "Q12209969",
        reason: "Khalid Al Ma'awali chairs the Shura Council; he was never Sultan",
        title: "Sultan of Oman",
    },
    {
        personId: "Q3497798",
        reason: "Ghalib bin Ali was Imam of Oman, the Sultan's rival",
        title: "Sultan of Oman",
    },
    {
        personId: "Q22689689",
        reason: "Muhammad al-Khalili was Imam of Oman, the Sultan's rival",
        title: "Sultan of Oman",
    },
    {
        personId: "Q379197",
        reason: "Heng Samrin led the People's Republic of Kampuchea; he was never King",
        title: "King of Cambodia",
    },
    {
        personId: "Q7427256",
        reason: "Saukam Khoy was acting President of the Khmer Republic",
        title: "King of Cambodia",
    },
    {
        personId: "Q27146606",
        reason: "A person labelled only in Arabic, wrongly given Burkina Faso's military leadership",
        title: "Military leader",
    },
    {
        personId: "Q1111673",
        reason: "Princess Antoinette never reigned; her brother Rainier III did",
        title: "Prince of Monaco",
    },
];

/**
 * Takes the excluded statements off an official or person.
 *
 * @param record - Anyone with a Wikidata id and positions.
 * @returns The record without them, or `null` when nothing else is left.
 */
export const withoutExcludedPositions = <
    T extends { positions: { title: string }[]; wikidataId: string | null },
>(
    record: T
): T | null => {
    const excluded = POSITION_EXCLUSIONS.filter((entry) => entry.personId === record.wikidataId);
    if (excluded.length === 0) {
        return record;
    }
    const positions = record.positions.filter(
        (position) => !excluded.some((entry) => entry.title === position.title)
    );
    return positions.length > 0 ? { ...record, positions } : null;
};

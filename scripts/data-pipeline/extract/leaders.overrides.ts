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

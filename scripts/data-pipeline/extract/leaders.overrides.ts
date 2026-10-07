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
    {
        code: "SDN",
        endDate: null,
        kind: "hos",
        personId: "Q63111184",
        source: "https://en.wikipedia.org/wiki/Transitional_Sovereignty_Council",
        startDate: "2019-08-21",
        title: "Chairman of the Transitional Sovereignty Council",
    },
    {
        code: "SOM",
        endDate: null,
        kind: "hos",
        personId: "Q319153",
        source: "https://en.wikipedia.org/wiki/President_of_Somalia",
        startDate: "2022-05-15",
        title: "President of Somalia",
    },
    {
        code: "CAF",
        endDate: null,
        kind: "hog",
        personId: "Q88310768",
        source: "https://www.koaci.com/article/2026/05/17/centrafrique/politique/centrafrique-felix-moloua-reconduit-a-la-tete-du-gouvernement_196729.html",
        startDate: "2026-05-15",
        title: "Prime Minister of the Central African Republic",
    },
    {
        code: "COG",
        endDate: null,
        kind: "hog",
        personId: "Q4752077",
        source: "https://www.ecofinagency.com/news/2604-55016-republic-of-congo-names-new-government-aims-to-accelerate-development-agenda",
        startDate: "2026-04-23",
        title: "Prime Minister of the Republic of the Congo",
    },
    {
        code: "MUS",
        endDate: null,
        kind: "hog",
        personId: "Q57836",
        source: "https://en.wikipedia.org/wiki/Prime_Minister_of_Mauritius",
        startDate: "2024-11-13",
        title: "Prime Minister of Mauritius",
    },
    {
        code: "PSE",
        endDate: null,
        kind: "hog",
        personId: "Q20423278",
        source: "https://en.wikipedia.org/wiki/Prime_Minister_of_Palestine",
        startDate: "2024-03-31",
        title: "Prime Minister of Palestine",
    },
    {
        code: "VUT",
        endDate: null,
        kind: "hog",
        personId: "Q115252004",
        source: "https://en.wikipedia.org/wiki/Prime_Minister_of_Vanuatu",
        startDate: "2025-02-11",
        title: "Prime Minister of Vanuatu",
    },
    // Muammar Gaddafi led Libya from the 1969 coup to his fall; Wikidata records only his PM term.
    {
        code: "LBY",
        endDate: "2011-10-20",
        kind: "hos",
        personId: "Q19878",
        source: "https://en.wikipedia.org/wiki/Muammar_Gaddafi",
        startDate: "1969-09-01",
        title: "Brotherly Leader and Guide of the Revolution",
    },
    // Denis Sassou-Nguesso's first presidency; Wikidata records only the one since 1997.
    {
        code: "COG",
        endDate: "1992-08-31",
        kind: "hos",
        personId: "Q57418",
        source: "https://en.wikipedia.org/wiki/President_of_the_Republic_of_the_Congo",
        startDate: "1979-02-08",
        title: "President of the Republic of the Congo",
    },
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
    /** Only the term with these dates, when the person held the office more than once. */
    endDate?: IsoDate;
    /** The person's Wikidata item. */
    personId: string;
    /** Why the statement is wrong. */
    reason: string;
    startDate?: IsoDate;
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
        endDate: "2024-05-19",
        personId: "Q319153",
        reason: "Hassan Sheikh Mohamud's second term didn't end in May 2024; it runs on (disputed)",
        startDate: "2022-05-15",
        title: "President of Somalia",
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
    T extends {
        positions: { endDate: IsoDate | null; startDate: IsoDate | null; title: string }[];
        wikidataId: string | null;
    },
>(
    record: T
): T | null => {
    const excluded = POSITION_EXCLUSIONS.filter((entry) => entry.personId === record.wikidataId);
    if (excluded.length === 0) {
        return record;
    }
    const positions = record.positions.filter(
        (position) =>
            !excluded.some(
                (entry) =>
                    entry.title === position.title &&
                    (entry.startDate === undefined || entry.startDate === position.startDate) &&
                    (entry.endDate === undefined || entry.endDate === position.endDate)
            )
    );
    return positions.length > 0 ? { ...record, positions } : null;
};

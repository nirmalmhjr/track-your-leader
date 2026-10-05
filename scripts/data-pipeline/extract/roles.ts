import type { Portfolio, RoleCategory } from "@/types/travel.types";

/**
 * Turns office titles from any source ("Min. of Foreign Affairs", "Chancellor of the Exchequer",
 * "United States Secretary of State") into the explorer's generic role categories and
 * portfolios, so filters work the same across political systems.
 */

/** CIA abbreviations, expanded in order (longer forms first). */
const ABBREVIATIONS: readonly (readonly [RegExp, string])[] = [
    [/\bSec\. Gen\./g, "Secretary General"],
    [/\bMins?\./g, "Minister"],
    [/\bPres\./g, "President"],
    [/\bSec\./g, "Secretary"],
    [/\bDep\./g, "Deputy"],
    [/\bFed\./g, "Federal"],
    [/\bAdmin\./g, "Administration"],
    [/\bDept\./g, "Department"],
    [/\bChmn\./g, "Chairman"],
    [/\bGen\./g, "General"],
    [/\bGov\./g, "Governor"],
    [/\bCoord\./g, "Coordinating"],
    [/\bAsst\./g, "Assistant"],
    [/\bNatl\./g, "National"],
    [/\bIntl\./g, "International"],
    [/\bDir\./g, "Director"],
    [/\bRep\./g, "Representative"],
    [/\s+&\s+/g, " and "],
    [/,\s+and\s+/g, " and "],
];

const HEAD_OF_STATE = /^(president|federal president|king|queen|emperor|monarch|sultan|emir)$/;
/** "Prime Minister of Iran" too: offices a country abolished aren't its current one. */
const HEAD_OF_GOVERNMENT = /^(prime minister|premier|chancellor)(,|$)|^prime minister of /;
const DEPUTY_LEADER =
    /^(vice president|deputy president|(first )?deputy prime minister|vice chancellor|(executive |first )?vice premier|first secretary of state)\b/;
const JUNIOR_MINISTER =
    /^(minister of state|deputy minister|vice minister|state minister|parliamentary secretary|junior minister)\b/;
const MINISTER =
    /^(minister|secretary of state for|secretary for|chancellor of the exchequer|attorney general|lord chancellor|chief cabinet secretary|state councilor|coordinating minister|chief secretary to the treasury|leader of the house|united states (secretary|attorney general|trade representative))\b/;
/** Checked after the ministerial patterns, so "Minister of Justice" stays a minister. */
const CENTRAL_BANKER =
    /\b(governor|chair(man|woman|person)?|president)\b.*\b(central|reserve|national|state) bank\b|\b(central|reserve) bank\b.*\bgovernor\b|\bmonetary authority\b/;
const JUDICIARY =
    /\b(judge|justice of|chief justice|magistrate|president of the (supreme|constitutional|high) court|prosecutor general|procurator general|public prosecutor)\b/;
const DIPLOMAT =
    /\b(ambassador|permanent representative|high commissioner (to|in)|consul general|special envoy)\b/;
const MILITARY_LEADER =
    /\b(chief of (the )?(defen[cs]e|army|naval|air|general|joint) staff|commander(-in-chief| of the (armed|army|navy|air))|chief of staff of the (armed|army))\b/;
const LEGISLATOR =
    /\b(member of (the )?(parliament|national assembly|national council|house of|senate|chamber of|congress|legislative|state duma|federal assembly|bundestag|riksdag|storting|knesset|majlis|diet|lok sabha|rajya sabha|european parliament)|senator|deputy (of|to) the|people's deputy|federal deputy|speaker of (the )?(parliament|house|national assembly|senate|legislative)|member of parliament)\b|^mp$/;
const REGIONAL_LEADER =
    /^((deputy |lieutenant |vice[- ])?governor|premier of|chief minister|minister-president|prefect|state governor|provincial governor|president of the (regional|provincial|state|departmental) (council|government|assembly)|first minister of (scotland|wales|northern ireland))\b/;
const LOCAL_LEADER =
    /\b(lord mayor|mayor|alcalde|maire|bürgermeister|burgomaster|sindaco|prefeito)\b/;
const PARTY_LEADER =
    /\b(general secretary|secretary[- ]general|chair(man|woman|person)?|leader|president) of the .*\bparty\b|\bparty (leader|chair(man|woman|person)?)\b/;
const MINISTRY_TITLE = /^minister (of|for) (.+)$/i;
const WHITESPACE = /\s+/g;

/** First match wins; checked against the lower-cased, expanded title. */
const PORTFOLIO_RULES: readonly (readonly [RegExp, Portfolio])[] = [
    [/foreign|external affairs|international relations|secretary of state$/, "foreign_affairs"],
    [/finance|treasury|exchequer/, "finance"],
    [/defen[cs]e|armed forces/, "defence"],
    [
        /home affairs|home department|interior|internal affairs|public security|homeland/,
        "home_affairs",
    ],
    [/trade|commerce|industry|economic affairs|economy/, "trade"],
    [/energy|petroleum|power/, "energy"],
    [/environment|climate|ecology/, "environment"],
    [/health|medical/, "health"],
    [/education|schools|universit/, "education"],
    [/labou?r|employment|workforce/, "labour"],
    [/justice|\blaw\b|legal affairs/, "justice"],
    [/agricultur|farming|livestock|fisher|forestry|food/, "agriculture"],
    [/culture|heritage|\barts\b/, "culture"],
    [/tourism/, "tourism"],
    [/transport|aviation|railway|roads|highways|shipping|maritime/, "transport"],
    [/women|gender|children/, "women"],
    [/youth|sport/, "youth"],
    [/science|technology|research|innovation|digital/, "science"],
    [/social|welfare|family|housing/, "social_affairs"],
];

export interface RoleInfo {
    categories: RoleCategory[];
    /** `false` for titles that name no office at all. */
    isTracked: boolean;
    ministry: string | null;
    portfolio: Portfolio | null;
    /** Readable title with abbreviations expanded. */
    title: string;
}

/**
 * Expands CIA abbreviations ("Min. of Defense" becomes "Minister of Defense").
 *
 * @param title - Title as published.
 * @returns The expanded title.
 */
export const expandTitle = (title: string): string => {
    let expanded = title.replace(WHITESPACE, " ").trim();
    for (const [pattern, replacement] of ABBREVIATIONS) {
        expanded = expanded.replace(pattern, replacement);
    }
    return expanded;
};

/** Office patterns in order: the first that matches gives the category. */
const CATEGORY_RULES: readonly (readonly [RegExp, RoleCategory])[] = [
    [HEAD_OF_STATE, "head_of_state"],
    [HEAD_OF_GOVERNMENT, "head_of_government"],
    [DEPUTY_LEADER, "deputy_leader"],
    [JUNIOR_MINISTER, "junior_minister"],
    [MINISTER, "minister"],
    [CENTRAL_BANKER, "central_banker"],
    [JUDICIARY, "judiciary"],
    [DIPLOMAT, "diplomat"],
    [MILITARY_LEADER, "military_leader"],
    [LEGISLATOR, "legislator"],
    [REGIONAL_LEADER, "regional_leader"],
    [LOCAL_LEADER, "local_leader"],
    [PARTY_LEADER, "party_leader"],
];

const categorize = (lower: string): RoleCategory | null =>
    CATEGORY_RULES.find(([pattern]) => pattern.test(lower))?.[1] ?? null;

/**
 * Classifies an office title.
 *
 * @param rawTitle - Title from any source, abbreviated or not.
 * @returns Categories, portfolio and ministry, plus whether the title names an office at all.
 */
export const classifyTitle = (rawTitle: string): RoleInfo => {
    const title = expandTitle(rawTitle);
    const lower = title.toLowerCase();
    const category = categorize(lower) ?? "senior_official";
    const isMinisterial = category === "minister" || category === "junior_minister";
    const ministryName = category === "minister" ? title.match(MINISTRY_TITLE)?.[2] : undefined;

    return {
        categories: [category],
        isTracked: lower.length > 0,
        ministry: ministryName ? `Ministry of ${ministryName}` : null,
        portfolio: isMinisterial
            ? (PORTFOLIO_RULES.find(([pattern]) => pattern.test(lower))?.[1] ?? null)
            : null,
        title,
    };
};

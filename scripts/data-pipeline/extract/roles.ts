import type { Portfolio, RoleCategory } from "@/features/travel-explorer/types/travel.types";

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

const EXCLUDED = [
    /\bambassador\b/,
    /\bpermanent representative\b/,
    /\bbank\b/,
    /\bbundesbank\b/,
    /\bauditor\b/,
    /\bchief justice\b/,
    /\bchief of (the )?(defen[cs]e|army|naval|air|general) staff\b/,
    /^governor\b/,
    /\bcommander\b/,
];

const HEAD_OF_STATE = /^(president|federal president|king|queen|emperor|monarch|sultan|emir)$/;
const HEAD_OF_GOVERNMENT = /^(prime minister|premier|chancellor)(,|$)/;
const DEPUTY_LEADER =
    /^(vice president|deputy president|(first )?deputy prime minister|vice chancellor|(executive |first )?vice premier|first secretary of state)\b/;
const JUNIOR_MINISTER =
    /^(minister of state|deputy minister|vice minister|state minister|parliamentary secretary|junior minister)\b/;
const MINISTER =
    /^(minister|secretary of state for|secretary for|chancellor of the exchequer|attorney general|lord chancellor|chief cabinet secretary|state councilor|coordinating minister|chief secretary to the treasury|leader of the house|united states (secretary|attorney general|trade representative))\b/;
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
];

export interface RoleInfo {
    categories: RoleCategory[];
    /** `false` for offices the explorer doesn't follow (ambassadors, central bankers…). */
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

const categorize = (lower: string): RoleCategory | null => {
    if (HEAD_OF_STATE.test(lower)) {
        return "head_of_state";
    }
    if (HEAD_OF_GOVERNMENT.test(lower)) {
        return "head_of_government";
    }
    if (DEPUTY_LEADER.test(lower)) {
        return "deputy_leader";
    }
    if (JUNIOR_MINISTER.test(lower)) {
        return "junior_minister";
    }
    if (MINISTER.test(lower)) {
        return "minister";
    }
    return null;
};

/**
 * Classifies an office title.
 *
 * @param rawTitle - Title from any source, abbreviated or not.
 * @returns Categories, portfolio and ministry, plus whether the office is tracked at all
 * (ambassadors, central bankers and military chiefs are not).
 */
export const classifyTitle = (rawTitle: string): RoleInfo => {
    const title = expandTitle(rawTitle);
    const lower = title.toLowerCase();
    const category = categorize(lower) ?? "senior_official";
    const isMinisterial = category === "minister" || category === "junior_minister";
    const ministryName = category === "minister" ? title.match(MINISTRY_TITLE)?.[2] : undefined;

    return {
        categories: [category],
        isTracked: !EXCLUDED.some((pattern) => pattern.test(lower)),
        ministry: ministryName ? `Ministry of ${ministryName}` : null,
        portfolio: isMinisterial
            ? (PORTFOLIO_RULES.find(([pattern]) => pattern.test(lower))?.[1] ?? null)
            : null,
        title,
    };
};

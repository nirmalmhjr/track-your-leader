import { ROLE_RANK } from "@/lib/travel/travel.constants";
import type { Official, OfficialGroup, Position, RoleCategory } from "@/types/travel.types";

const LEADERSHIP_CATEGORIES = new Set<RoleCategory>([
    "head_of_state",
    "head_of_government",
    "deputy_leader",
]);

const MINISTER_CATEGORIES = new Set<RoleCategory>(["minister", "junior_minister"]);

const REGIONAL_CATEGORIES = new Set<RoleCategory>(["regional_leader", "local_leader"]);

/** "Minister of ", "Minister for the ": the part of a minister's title before the portfolio. */
const MINISTER_TITLE_PREFIX = /^minister (?:of|for) (?:the )?/i;

/**
 * Whether a position is held today: it has no end date, and the source dated it at all.
 *
 * @param position - Position to test.
 * @returns `true` for a position still held.
 */
export const isCurrentPosition = (position: Pick<Position, "endDate" | "undated">): boolean =>
    position.endDate === null && !position.undated;

/**
 * Returns the position an official currently holds, if any.
 *
 * @param official - Official to inspect.
 * @returns The most recent open-ended position, or `null` for former office holders.
 */
export const getCurrentPosition = (official: Official): Position | null =>
    official.positions.find(isCurrentPosition) ?? null;

/**
 * Returns the position that best describes an official: the current one, otherwise the most
 * senior they held.
 *
 * @param official - Official to inspect.
 * @returns The representative position.
 */
export const getPrimaryPosition = (official: Official): Position => {
    const current = getCurrentPosition(official);
    if (current) {
        return current;
    }
    // A former official is described by their most senior office (a chancellor who later sat in
    // parliament is a former chancellor); positions come newest first, so ties go to the latest.
    const rankOf = (position: Position): number =>
        Math.min(...position.categories.map((category) => ROLE_RANK[category]));
    return official.positions.reduce((best, position) =>
        rankOf(position) < rankOf(best) ? position : best
    );
};

/**
 * Seniority rank used for sorting, where lower is more senior.
 *
 * @param official - Official to rank.
 * @returns Rank derived from the primary position's most senior category.
 */
export const getOfficialRank = (official: Official): number =>
    Math.min(...getPrimaryPosition(official).categories.map((category) => ROLE_RANK[category]));

/**
 * Classifies a position by its most senior kind of office.
 *
 * @param categories - Categories of the position.
 * @returns Leadership, ministers, legislators, regional and local leaders, the judiciary, or
 * (senior) officials such as diplomats, central bankers and military chiefs.
 */
export const getCategoryGroup = (
    categories: readonly RoleCategory[]
): Exclude<OfficialGroup, "former"> => {
    const has = (group: ReadonlySet<RoleCategory>) =>
        categories.some((category) => group.has(category));
    if (has(LEADERSHIP_CATEGORIES)) {
        return "leadership";
    }
    if (has(MINISTER_CATEGORIES)) {
        return "ministers";
    }
    if (categories.includes("legislator")) {
        return "legislators";
    }
    if (has(REGIONAL_CATEGORIES)) {
        return "regional";
    }
    if (categories.includes("judiciary")) {
        return "judiciary";
    }
    return "officials";
};

/**
 * Returns the other offices an official holds today, beside the one that describes them, such
 * as the ministries a prime minister keeps. Parliamentary seats are left out: most ministers
 * also sit in parliament, and the seat adds nothing next to their ministry.
 *
 * @param official - Official to inspect.
 * @returns Current positions other than the primary one, newest first.
 */
export const getOtherCurrentPositions = (official: Official): Position[] => {
    const primary = getPrimaryPosition(official);
    return official.positions.filter(
        (position) =>
            position !== primary &&
            isCurrentPosition(position) &&
            !position.categories.includes("legislator")
    );
};

/**
 * Shortens a minister's title to the portfolio it names, for lists already headed "Portfolio".
 *
 * @param title - Position title, such as "Minister of Finance".
 * @returns "Finance"; titles that don't follow the "Minister of" pattern come back unchanged.
 */
export const getPortfolioName = (title: string): string => {
    const portfolio = title.replace(MINISTER_TITLE_PREFIX, "");
    if (portfolio === title || portfolio.length === 0) {
        return title;
    }
    return `${portfolio.charAt(0).toUpperCase()}${portfolio.slice(1)}`;
};

/**
 * Returns the most senior kind of office a position carries, for a one-word label.
 *
 * @param position - Position to inspect.
 * @returns Its most senior category, such as `central_banker` or `diplomat`.
 */
export const getLeadingCategory = (position: Pick<Position, "categories">): RoleCategory =>
    position.categories.reduce((best, category) =>
        ROLE_RANK[category] < ROLE_RANK[best] ? category : best
    );

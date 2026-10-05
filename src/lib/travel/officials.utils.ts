import { ROLE_RANK } from "@/lib/travel/travel.constants";
import type { Official, OfficialGroup, Position, RoleCategory } from "@/types/travel.types";

const LEADERSHIP_CATEGORIES = new Set<RoleCategory>([
    "head_of_state",
    "head_of_government",
    "deputy_leader",
]);

const MINISTER_CATEGORIES = new Set<RoleCategory>(["minister", "junior_minister"]);

/**
 * Returns the position an official currently holds, if any.
 *
 * @param official - Official to inspect.
 * @returns The most recent open-ended position, or `null` for former office holders.
 */
export const getCurrentPosition = (official: Official): Position | null =>
    official.positions.find((position) => position.endDate === null) ?? null;

/**
 * Returns the position that best describes an official: the current one, otherwise the latest.
 *
 * @param official - Official to inspect.
 * @returns The representative position.
 */
export const getPrimaryPosition = (official: Official): Position =>
    getCurrentPosition(official) ?? official.positions[0];

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
 * @returns Leadership, ministers or (senior) officials.
 */
export const getCategoryGroup = (
    categories: readonly RoleCategory[]
): Exclude<OfficialGroup, "former"> => {
    if (categories.some((category) => LEADERSHIP_CATEGORIES.has(category))) {
        return "leadership";
    }
    if (categories.some((category) => MINISTER_CATEGORIES.has(category))) {
        return "ministers";
    }
    return "officials";
};

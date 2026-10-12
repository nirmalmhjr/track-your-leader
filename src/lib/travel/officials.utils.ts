import { ROLE_RANK } from "@/lib/travel/travel.constants";
import type { CountryCode } from "@/types/geo.types";
import type {
    OfficeTerms,
    Official,
    OfficialGroup,
    Position,
    RoleCategory,
} from "@/types/travel.types";

const LEADERSHIP_CATEGORIES = new Set<RoleCategory>([
    "head_of_state",
    "head_of_government",
    "governor_general",
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
 * The country a position belongs to: its own when it has one, otherwise the official's.
 *
 * @param official - Holder of the position.
 * @param position - Position to place.
 * @returns The country's code.
 */
export const getPositionCountry = (
    official: Pick<Official, "countryCode">,
    position: Pick<Position, "countryCode">
): CountryCode => position.countryCode ?? official.countryCode;

/**
 * An official as listed by one country: only the positions that belong to it, so Charles III,
 * filed under the United Kingdom, reads as Monarch of Canada on Canada's page. The id stays the
 * same, so the profile and the trips are still the one person's.
 *
 * @param official - Official to scope.
 * @param code - Country listing them.
 * @returns The official (unchanged when every position belongs there, and always in their own
 * country), or `null` when they held no office of that country.
 */
export const scopeOfficialToCountry = (official: Official, code: CountryCode): Official | null => {
    const positions = official.positions.filter(
        (position) => getPositionCountry(official, position) === code
    );
    if (positions.length === official.positions.length) {
        return official;
    }
    if (positions.length === 0) {
        return official.countryCode === code ? official : null;
    }
    return { ...official, positions };
};

/**
 * Groups officials under every country they held an office of, each scoped to that country
 * (see `scopeOfficialToCountry`).
 *
 * @param officials - Officials to group.
 * @returns Officials per country code.
 */
export const groupOfficialsByCountry = (
    officials: readonly Official[]
): Map<CountryCode, Official[]> => {
    const byCountry = new Map<CountryCode, Official[]>();
    for (const official of officials) {
        const codes = new Set([
            official.countryCode,
            ...official.positions.map((position) => getPositionCountry(official, position)),
        ]);
        for (const code of codes) {
            const scoped = scopeOfficialToCountry(official, code);
            if (!scoped) {
                continue;
            }
            const list = byCountry.get(code);
            if (list) {
                list.push(scoped);
            } else {
                byCountry.set(code, [scoped]);
            }
        }
    }
    return byCountry;
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
 * also sit in parliament, and the seat adds nothing next to their ministry. So are offices of
 * other countries (Charles III's realms), which `getOtherOfficeCountries` counts instead.
 *
 * @param official - Official to inspect.
 * @returns Current positions other than the primary one, newest first.
 */
export const getOtherCurrentPositions = (official: Official): Position[] => {
    const primary = getPrimaryPosition(official);
    const country = getPositionCountry(official, primary);
    return official.positions.filter(
        (position) =>
            position !== primary &&
            isCurrentPosition(position) &&
            getPositionCountry(official, position) === country &&
            !position.categories.includes("legislator")
    );
};

/**
 * The other countries where an official holds an office today: for Charles III, listed by
 * Canada, the United Kingdom and the other realms he reigns over.
 *
 * @param official - Official to inspect (not scoped to one country).
 * @param code - The country listing them.
 * @returns Codes of the other countries, in the order of the official's positions.
 */
export const getOtherOfficeCountries = (official: Official, code: CountryCode): CountryCode[] => [
    ...new Set(
        official.positions
            .filter(isCurrentPosition)
            .map((position) => getPositionCountry(official, position))
            .filter((country) => country !== code)
    ),
];

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

/**
 * Groups an official's positions by office, so an office held twice (Gyanendra, King of Nepal in
 * 1950–51 and 2001–08) is one entry with two terms. Offices keep the positions' order: current
 * ones first, then the newest.
 *
 * @param positions - Positions, sorted as stored.
 * @returns One entry per office.
 */
export const groupPositionsByOffice = (positions: readonly Position[]): OfficeTerms[] => {
    const offices = new Map<string, OfficeTerms>();
    for (const position of positions) {
        const office = offices.get(position.title) ?? {
            isCurrent: false,
            terms: [],
            title: position.title,
        };
        office.terms.push(position);
        office.isCurrent ||= isCurrentPosition(position);
        offices.set(position.title, office);
    }
    return [...offices.values()];
};

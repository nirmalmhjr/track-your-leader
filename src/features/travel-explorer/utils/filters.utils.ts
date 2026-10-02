import { ROLE_RANK } from "@/features/travel-explorer/constants/explorer.constants";
import type {
    ExplorerFilters,
    OfficialGroup,
} from "@/features/travel-explorer/types/explorer.types";
import type {
    Official,
    Position,
    TravelRecord,
} from "@/features/travel-explorer/types/travel.types";
import { rangesOverlap } from "@/features/travel-explorer/utils/date.utils";

const DIACRITICS_PATTERN = /\p{Diacritic}/gu;

const LEADERSHIP_CATEGORIES = new Set(["head_of_state", "head_of_government", "deputy_leader"]);
const MINISTER_CATEGORIES = new Set(["minister", "junior_minister"]);

export const EMPTY_FILTERS: ExplorerFilters = {
    city: "",
    destinations: [],
    from: null,
    includePreviousPositions: false,
    name: "",
    party: null,
    portfolios: [],
    regions: [],
    roles: [],
    statuses: [],
    tenure: null,
    to: null,
    types: [],
};

/**
 * Normalises text for accent- and case-insensitive matching.
 *
 * @param value - Raw text.
 * @returns Lower-cased text without diacritics.
 */
export const normalizeSearchText = (value: string): string =>
    value.normalize("NFD").replace(DIACRITICS_PATTERN, "").toLowerCase().trim();

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
 * Assigns an official to a display group in the results list.
 *
 * @param official - Official to classify.
 * @returns The group the official is listed under.
 */
export const getOfficialGroup = (official: Official): OfficialGroup => {
    const current = getCurrentPosition(official);

    if (!current) {
        return "former";
    }
    if (current.categories.some((category) => LEADERSHIP_CATEGORIES.has(category))) {
        return "leadership";
    }
    if (current.categories.some((category) => MINISTER_CATEGORIES.has(category))) {
        return "ministers";
    }
    return "officials";
};

/**
 * Tests an official against the person-level filters.
 *
 * @param official - Official to test.
 * @param filters - Active explorer filters.
 * @returns `true` when the official satisfies every person-level filter.
 */
export const matchesOfficialFilters = (official: Official, filters: ExplorerFilters): boolean => {
    const isCurrent = getCurrentPosition(official) !== null;

    if (filters.tenure === "current" && !isCurrent) {
        return false;
    }
    if (filters.tenure === "former" && isCurrent) {
        return false;
    }
    if (filters.party && official.party !== filters.party) {
        return false;
    }

    const query = normalizeSearchText(filters.name);
    if (query && !normalizeSearchText(official.fullName).includes(query)) {
        return false;
    }

    const consideredPositions = filters.includePreviousPositions
        ? official.positions
        : official.positions.filter((position) => position.endDate === null || !isCurrent);

    if (
        filters.roles.length > 0 &&
        !consideredPositions.some((position) =>
            position.categories.some((category) => filters.roles.includes(category))
        )
    ) {
        return false;
    }

    return (
        filters.portfolios.length === 0 ||
        consideredPositions.some(
            (position) =>
                position.portfolio !== null && filters.portfolios.includes(position.portfolio)
        )
    );
};

/**
 * Tests a trip against the travel-level filters (dates, type, status and destination).
 *
 * @param record - Trip to test.
 * @param filters - Active explorer filters.
 * @returns `true` when the trip satisfies every travel-level filter.
 */
export const matchesTravelFilters = (record: TravelRecord, filters: ExplorerFilters): boolean => {
    if (!rangesOverlap(record.startDate, record.endDate, filters.from, filters.to)) {
        return false;
    }
    if (filters.types.length > 0 && !filters.types.includes(record.type)) {
        return false;
    }
    if (filters.statuses.length > 0 && !filters.statuses.includes(record.status)) {
        return false;
    }
    if (
        filters.regions.length > 0 &&
        !filters.regions.some((region) => region === record.destination.region)
    ) {
        return false;
    }
    if (
        filters.destinations.length > 0 &&
        !filters.destinations.includes(record.destination.countryCode)
    ) {
        return false;
    }

    const city = normalizeSearchText(filters.city);
    return !city || normalizeSearchText(record.destination.city).includes(city);
};

/**
 * Whether any trip-level filter is active, in which case officials without matching trips are
 * hidden from results.
 *
 * @param filters - Active explorer filters.
 * @returns `true` when at least one travel filter narrows the trips.
 */
export const hasTravelFilters = (filters: ExplorerFilters): boolean =>
    filters.from !== null ||
    filters.to !== null ||
    filters.types.length > 0 ||
    filters.statuses.length > 0 ||
    filters.regions.length > 0 ||
    filters.destinations.length > 0 ||
    filters.city.trim() !== "";

/**
 * Counts active filter groups, treating a date range as a single filter.
 *
 * @param filters - Active explorer filters.
 * @returns Number of filters that differ from their defaults.
 */
export const countActiveFilters = (filters: ExplorerFilters): number =>
    [
        filters.name.trim() !== "",
        filters.roles.length > 0,
        filters.includePreviousPositions,
        filters.tenure !== null,
        filters.portfolios.length > 0,
        filters.party !== null,
        filters.from !== null || filters.to !== null,
        filters.types.length > 0,
        filters.statuses.length > 0,
        filters.regions.length > 0,
        filters.destinations.length > 0,
        filters.city.trim() !== "",
    ].filter(Boolean).length;

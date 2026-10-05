import type { ExplorerFilters } from "@/features/travel-explorer/types/explorer.types";
import { rangesOverlap } from "@/lib/travel/date.utils";
import { getCategoryGroup, getCurrentPosition } from "@/lib/travel/officials.utils";
import { normalizeSearchText } from "@/lib/utils";
import type { Official, OfficialGroup, TravelRecord } from "@/types/travel.types";

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
 * Assigns an official to a display group in the results list.
 *
 * @param official - Official to classify.
 * @returns The group the official is listed under.
 */
export const getOfficialGroup = (official: Official): OfficialGroup => {
    const current = getCurrentPosition(official);
    return current ? getCategoryGroup(current.categories) : "former";
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

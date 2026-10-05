import type {
    ExplorerFilters,
    ExplorerSelection,
} from "@/features/travel-explorer/types/explorer.types";
import { rangesOverlap } from "@/lib/travel/date.utils";
import {
    getCategoryGroup,
    getCurrentPosition,
    isCurrentPosition,
} from "@/lib/travel/officials.utils";
import { normalizeSearchText } from "@/lib/utils";
import type { CountryCode } from "@/types/geo.types";
import type { OfficeTenure, Official, OfficialGroup, TravelRecord } from "@/types/travel.types";

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
 * The same filters with the date range lifted, for trip histories a date window would cut short.
 *
 * @param filters - Active explorer filters.
 * @returns The filters without `from` and `to`.
 */
export const withoutDateRange = (filters: ExplorerFilters): ExplorerFilters => ({
    ...filters,
    from: null,
    to: null,
});

/**
 * Whether an official holds an office today.
 *
 * @param official - Official to test.
 * @returns `true` while any of their positions is open-ended.
 */
export const isInOffice = (official: Official): boolean => getCurrentPosition(official) !== null;

/**
 * The side of a country's in-office / former switch that is actually shown: an empty side (say,
 * the tenure filter excludes it) gives way to the other one.
 *
 * @param chosen - Side the visitor picked.
 * @param counts - Officials on each side.
 * @returns The side to show.
 */
export const pickOfficeTenure = (
    chosen: OfficeTenure,
    counts: Readonly<Record<OfficeTenure, number>>
): OfficeTenure => {
    const other: OfficeTenure = chosen === "current" ? "former" : "current";
    return counts[chosen] === 0 ? other : chosen;
};

/**
 * Trips that skip the date range. A former office holder's travel ended when they left, so the
 * recent window the explorer opens on would show none of it: one former official's profile, or
 * a country's former officials while that side of its switch is open, show every year instead.
 */
export type DateRangeExemption =
    | { kind: "none" }
    | { kind: "official"; officialId: string }
    | { countryCode: CountryCode; kind: "former"; officialIds: ReadonlySet<string> };

const NO_EXEMPTION: DateRangeExemption = { kind: "none" };

interface DateRangeExemptionInput {
    /** Side of the selected country's in-office / former switch the visitor picked. */
    chosenTenure: OfficeTenure;
    officialById: ReadonlyMap<string, Official>;
    /** The selected country's officials passing the person-level filters. */
    roster: readonly Official[];
    selection: ExplorerSelection;
}

/**
 * Works out which trips skip the date range for the current selection.
 *
 * @param input - Selection, the chosen side of the switch and the country's roster.
 * @returns The exemption in force.
 */
export const getDateRangeExemption = ({
    chosenTenure,
    officialById,
    roster,
    selection,
}: DateRangeExemptionInput): DateRangeExemption => {
    if (selection.official) {
        const official = officialById.get(selection.official);
        return official && !isInOffice(official)
            ? { kind: "official", officialId: official.id }
            : NO_EXEMPTION;
    }
    if (!selection.country || selection.view !== "officials") {
        return NO_EXEMPTION;
    }

    const former = roster.filter((official) => !isInOffice(official));
    const counts = { current: roster.length - former.length, former: former.length };
    if (former.length === 0 || pickOfficeTenure(chosenTenure, counts) !== "former") {
        return NO_EXEMPTION;
    }
    return {
        countryCode: selection.country,
        kind: "former",
        officialIds: new Set(former.map((official) => official.id)),
    };
};

/**
 * Builds the trip test for the current filters and exemption. While a country's former side is
 * open, that country's trips are its former officials' only, so the map and the counts describe
 * the people listed.
 *
 * @param filters - Active explorer filters.
 * @param exemption - Trips that skip the date range.
 * @returns Predicate telling whether a trip passes the travel-level filters.
 */
export const createTravelMatcher = (
    filters: ExplorerFilters,
    exemption: DateRangeExemption
): ((record: TravelRecord) => boolean) => {
    const undatedFilters = withoutDateRange(filters);

    return (record) => {
        if (exemption.kind === "official" && record.officialId === exemption.officialId) {
            return matchesTravelFilters(record, undatedFilters);
        }
        if (exemption.kind === "former" && record.originCountryCode === exemption.countryCode) {
            return (
                exemption.officialIds.has(record.officialId) &&
                matchesTravelFilters(record, undatedFilters)
            );
        }
        return matchesTravelFilters(record, filters);
    };
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
    const isCurrent = isInOffice(official);

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
        : official.positions.filter((position) => isCurrentPosition(position) || !isCurrent);

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

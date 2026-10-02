"use client";

import {
    createParser,
    debounce,
    parseAsArrayOf,
    parseAsBoolean,
    parseAsString,
    parseAsStringLiteral,
    useQueryStates,
} from "nuqs";
import { useCallback, useMemo } from "react";

import {
    COUNTRY_VIEWS,
    DESTINATION_REGIONS,
    OFFICE_TENURES,
    PORTFOLIOS,
    ROLE_CATEGORIES,
    TRAVEL_STATUSES,
    TRAVEL_TYPES,
} from "@/features/travel-explorer/constants/explorer.constants";
import type {
    CountryView,
    ExplorerFilters,
    ExplorerLevel,
    ExplorerSelection,
} from "@/features/travel-explorer/types/explorer.types";
import type {
    IsoDate,
    Official,
    TravelRecord,
} from "@/features/travel-explorer/types/travel.types";
import { isIsoDate } from "@/features/travel-explorer/utils/date.utils";
import { EMPTY_FILTERS } from "@/features/travel-explorer/utils/filters.utils";
import type { CountryCode } from "@/types/geo.types";

const TEXT_INPUT_DEBOUNCE_MS = 300;

const parseAsIsoDateString = createParser<IsoDate>({
    parse: (value) => (isIsoDate(value) ? value : null),
    serialize: (value) => value,
});

/** Selection changes push history entries so the browser back button walks up the hierarchy. */
const selectionParsers = {
    country: parseAsString.withOptions({ history: "push" }),
    official: parseAsString.withOptions({ history: "push" }),
    trip: parseAsString.withOptions({ history: "push" }),
    view: parseAsStringLiteral(COUNTRY_VIEWS).withDefault("officials"),
};

const filterParsers = {
    city: parseAsString
        .withDefault("")
        .withOptions({ limitUrlUpdates: debounce(TEXT_INPUT_DEBOUNCE_MS) }),
    destinations: parseAsArrayOf(parseAsString).withDefault([]),
    from: parseAsIsoDateString,
    includePreviousPositions: parseAsBoolean.withDefault(false),
    name: parseAsString
        .withDefault("")
        .withOptions({ limitUrlUpdates: debounce(TEXT_INPUT_DEBOUNCE_MS) }),
    party: parseAsString,
    portfolios: parseAsArrayOf(parseAsStringLiteral(PORTFOLIOS)).withDefault([]),
    regions: parseAsArrayOf(parseAsStringLiteral(DESTINATION_REGIONS)).withDefault([]),
    roles: parseAsArrayOf(parseAsStringLiteral(ROLE_CATEGORIES)).withDefault([]),
    statuses: parseAsArrayOf(parseAsStringLiteral(TRAVEL_STATUSES)).withDefault([]),
    tenure: parseAsStringLiteral(OFFICE_TENURES),
    to: parseAsIsoDateString,
    types: parseAsArrayOf(parseAsStringLiteral(TRAVEL_TYPES)).withDefault([]),
};

/** Short, readable query-string keys. */
const URL_KEYS = {
    destinations: "dest",
    includePreviousPositions: "prev",
    name: "q",
    portfolios: "portfolio",
    regions: "region",
    statuses: "status",
    types: "type",
} as const;

const explorerParsers = { ...selectionParsers, ...filterParsers };

/**
 * Explorer selection and filters, stored in the URL so every view can be shared and the
 * browser history mirrors the drill-down path.
 *
 * @returns Current selection, filters and the actions that change them.
 */
export function useExplorerState() {
    const [state, setState] = useQueryStates(explorerParsers, { urlKeys: URL_KEYS });

    const selection: ExplorerSelection = useMemo(
        () => ({
            country: state.country,
            official: state.official,
            trip: state.trip,
            view: state.view,
        }),
        [state.country, state.official, state.trip, state.view]
    );

    const filters: ExplorerFilters = useMemo(
        () => ({
            city: state.city,
            destinations: state.destinations,
            from: state.from,
            includePreviousPositions: state.includePreviousPositions,
            name: state.name,
            party: state.party,
            portfolios: state.portfolios,
            regions: state.regions,
            roles: state.roles,
            statuses: state.statuses,
            tenure: state.tenure,
            to: state.to,
            types: state.types,
        }),
        [
            state.city,
            state.destinations,
            state.from,
            state.includePreviousPositions,
            state.name,
            state.party,
            state.portfolios,
            state.regions,
            state.roles,
            state.statuses,
            state.tenure,
            state.to,
            state.types,
        ]
    );

    let level: ExplorerLevel = "world";
    if (selection.trip) {
        level = "trip";
    } else if (selection.official) {
        level = "official";
    } else if (selection.country) {
        level = "country";
    }

    const selectCountry = useCallback(
        (country: CountryCode | null, view: CountryView = "officials") =>
            setState({ country, official: null, trip: null, view }),
        [setState]
    );

    const selectOfficial = useCallback(
        (official: Official) =>
            setState({
                country: official.countryCode,
                official: official.id,
                trip: null,
                view: "officials",
            }),
        [setState]
    );

    const selectTrip = useCallback(
        (record: TravelRecord) =>
            setState({
                country: record.originCountryCode,
                official: record.officialId,
                trip: record.id,
                view: "officials",
            }),
        [setState]
    );

    const goToLevel = useCallback(
        (target: ExplorerLevel) => {
            if (target === "world") {
                return setState({ country: null, official: null, trip: null, view: null });
            }
            if (target === "country") {
                return setState({ official: null, trip: null });
            }
            return setState({ trip: null });
        },
        [setState]
    );

    const goUp = useCallback(() => {
        if (level === "trip") {
            return goToLevel("official");
        }
        if (level === "official") {
            return goToLevel("country");
        }
        return goToLevel("world");
    }, [level, goToLevel]);

    const setView = useCallback((view: CountryView) => setState({ view }), [setState]);

    const setFilters = useCallback(
        (patch: Partial<ExplorerFilters>) => setState(patch),
        [setState]
    );

    const resetFilters = useCallback(() => setState(EMPTY_FILTERS), [setState]);

    return {
        filters,
        goToLevel,
        goUp,
        level,
        resetFilters,
        selectCountry,
        selection,
        selectOfficial,
        selectTrip,
        setFilters,
        setView,
    };
}

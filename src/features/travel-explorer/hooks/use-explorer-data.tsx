"use client";

import {
    createContext,
    type ReactNode,
    use,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import { travelDataClient } from "@/features/travel-explorer/data/travel-data-client";
import type {
    LoadedCountryDetail,
    LoadedTravelBase,
    TravelDataSource,
} from "@/features/travel-explorer/data/travel-dataset";
import { useExplorerState } from "@/features/travel-explorer/hooks/use-explorer-state";
import type {
    IsoDate,
    Official,
    TrackedCountry,
    TravelRecord,
} from "@/features/travel-explorer/types/travel.types";
import { toIsoDate } from "@/features/travel-explorer/utils/date.utils";
import {
    hasTravelFilters,
    matchesOfficialFilters,
    matchesTravelFilters,
} from "@/features/travel-explorer/utils/filters.utils";
import type { CountryCode } from "@/types/geo.types";

const groupRecords = (
    records: readonly TravelRecord[],
    getKey: (record: TravelRecord) => string
): Map<string, TravelRecord[]> => {
    const groups = new Map<string, TravelRecord[]>();
    for (const record of records) {
        const key = getKey(record);
        const group = groups.get(key);
        if (group) {
            group.push(record);
        } else {
            groups.set(key, [record]);
        }
    }
    return groups;
};

const compareNewestFirst = (a: TravelRecord, b: TravelRecord): number =>
    b.startDate.localeCompare(a.startDate) || a.id.localeCompare(b.id);

export type DataStatus = "loading" | "ready" | "error";
export type DetailStatus = "loading" | "ready" | "error";

type BaseState =
    | { status: "loading" }
    | { status: "error" }
    | { loaded: LoadedTravelBase; status: "ready" };

type DetailState =
    | { status: "loading" | "error" }
    | { detail: LoadedCountryDetail; status: "ready" };

interface ExplorerData {
    /** All officials, ignoring filters (used by search). */
    allOfficials: readonly Official[];
    /** All trips, ignoring filters, newest first. */
    allRecords: readonly TravelRecord[];
    countries: readonly TrackedCountry[];
    countryByCode: ReadonlyMap<CountryCode, TrackedCountry>;
    dataSource: TravelDataSource;
    /** Whether each opened country's full records (biographies, purposes, sources) are loaded. */
    detailStatus: ReadonlyMap<CountryCode, DetailStatus>;
    /** Officials passing the person-level filters. */
    matchingOfficialIds: ReadonlySet<string>;
    /** Trips passing every filter, newest first. */
    matchingRecords: readonly TravelRecord[];
    officialById: ReadonlyMap<string, Official>;
    officialsByCountry: ReadonlyMap<CountryCode, readonly Official[]>;
    recordById: ReadonlyMap<string, TravelRecord>;
    recordsByDestination: ReadonlyMap<CountryCode, readonly TravelRecord[]>;
    recordsByOfficial: ReadonlyMap<string, readonly TravelRecord[]>;
    recordsByOrigin: ReadonlyMap<CountryCode, readonly TravelRecord[]>;
    /** Loads the data again after a failure. */
    retry: () => void;
    status: DataStatus;
    today: IsoDate;
    /** Whether trip-level filters are narrowing results. */
    travelFiltersActive: boolean;
    /** Day the data was last updated, or `null` for the samples. */
    updatedOn: IsoDate | null;
}

const ExplorerDataContext = createContext<ExplorerData | null>(null);

/** Countries, officials and trips, with loaded countries' full records in place of the compact ones. */
const useDataset = (
    base: LoadedTravelBase | null,
    details: ReadonlyMap<CountryCode, DetailState>
) =>
    useMemo(() => {
        const countries = base?.base.countries ?? [];
        const detailed = new Map<CountryCode, LoadedCountryDetail>();
        for (const [code, state] of details) {
            if (state.status === "ready") {
                detailed.set(code, state.detail);
            }
        }

        const fullOfficials = new Map(
            [...detailed.values()].flatMap((detail) =>
                detail.officials.map((official) => [official.id, official] as const)
            )
        );
        const officials = (base?.base.officials ?? []).map(
            (official) => fullOfficials.get(official.id) ?? official
        );

        const records: TravelRecord[] = [];
        for (const [code, group] of base?.base.recordsByOrigin ?? []) {
            for (const record of detailed.get(code)?.records ?? group) {
                records.push(record);
            }
        }
        records.sort(compareNewestFirst);

        const officialsByCountry = new Map<CountryCode, Official[]>();
        for (const official of officials) {
            const list = officialsByCountry.get(official.countryCode);
            if (list) {
                list.push(official);
            } else {
                officialsByCountry.set(official.countryCode, [official]);
            }
        }
        return {
            countries,
            countryByCode: new Map(countries.map((country) => [country.code, country])),
            officialById: new Map(officials.map((official) => [official.id, official])),
            officials,
            officialsByCountry,
            recordById: new Map(records.map((record) => [record.id, record])),
            records,
        };
    }, [base, details]);

/**
 * Loads the travel data, applies the current filters once and shares the indexed results with
 * the map and the panel, so both always describe the same slice of data. Opening a country
 * loads its full records in the background.
 */
export function ExplorerDataProvider({ children }: { children: ReactNode }) {
    const { filters, selection } = useExplorerState();
    const [today] = useState(() => toIsoDate(new Date()));
    const [attempt, setAttempt] = useState(0);
    const [baseState, setBaseState] = useState<BaseState>({ status: "loading" });
    const [details, setDetails] = useState<ReadonlyMap<CountryCode, DetailState>>(new Map());
    const requestedRef = useRef(new Set<CountryCode>());

    // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` changes when the user retries, which must load again.
    useEffect(() => {
        const controller = new AbortController();
        setBaseState({ status: "loading" });
        travelDataClient
            .getIndex(today, controller.signal)
            .then((loaded) => setBaseState({ loaded, status: "ready" }))
            .catch(() => {
                if (!controller.signal.aborted) {
                    setBaseState({ status: "error" });
                }
            });
        return () => controller.abort();
    }, [today, attempt]);

    const base = baseState.status === "ready" ? baseState.loaded : null;
    const dataset = useDataset(base, details);
    const selectedCountry = selection.country;

    useEffect(() => {
        const code = selectedCountry;
        const canLoad = base?.source === "generated" && code && dataset.countryByCode.has(code);
        if (!(canLoad && code) || requestedRef.current.has(code)) {
            return;
        }
        requestedRef.current.add(code);
        const setDetail = (state: DetailState) =>
            setDetails((previous) => new Map(previous).set(code, state));
        setDetail({ status: "loading" });
        // Not aborted when the selection changes: the file is small and kept for later visits.
        travelDataClient
            .getCountry(code, dataset.countryByCode, today)
            .then((detail) => setDetail({ detail, status: "ready" }))
            .catch(() => {
                requestedRef.current.delete(code);
                setDetail({ status: "error" });
            });
    }, [base, dataset.countryByCode, selectedCountry, today]);

    const retry = useCallback(() => setAttempt((count) => count + 1), []);

    const value = useMemo<ExplorerData>(() => {
        const matchingOfficialIds = new Set(
            dataset.officials
                .filter((official) => matchesOfficialFilters(official, filters))
                .map((official) => official.id)
        );
        const matchingRecords = dataset.records.filter(
            (record) =>
                matchingOfficialIds.has(record.officialId) && matchesTravelFilters(record, filters)
        );
        const detailStatus = new Map(
            [...details].map(([code, state]) => [code, state.status] as const)
        );

        return {
            allOfficials: dataset.officials,
            allRecords: dataset.records,
            countries: dataset.countries,
            countryByCode: dataset.countryByCode,
            dataSource: base?.source ?? "generated",
            detailStatus,
            matchingOfficialIds,
            matchingRecords,
            officialById: dataset.officialById,
            officialsByCountry: dataset.officialsByCountry,
            recordById: dataset.recordById,
            recordsByDestination: groupRecords(
                matchingRecords,
                (record) => record.destination.countryCode
            ),
            recordsByOfficial: groupRecords(matchingRecords, (record) => record.officialId),
            recordsByOrigin: groupRecords(matchingRecords, (record) => record.originCountryCode),
            retry,
            status: baseState.status,
            today,
            travelFiltersActive: hasTravelFilters(filters),
            updatedOn: base?.updatedOn ?? null,
        };
    }, [base, baseState.status, dataset, details, filters, retry, today]);

    return <ExplorerDataContext value={value}>{children}</ExplorerDataContext>;
}

/**
 * Reads the filtered explorer dataset.
 *
 * @returns Indexed dataset for the current filters.
 */
export function useExplorerData(): ExplorerData {
    const context = use(ExplorerDataContext);

    if (!context) {
        throw new Error("useExplorerData must be used inside <ExplorerDataProvider>");
    }

    return context;
}

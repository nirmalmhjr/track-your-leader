"use client";

import { useMemo } from "react";

import type { TripDownload } from "@/components/shared/download-trips-button";
import { useExplorerData } from "@/features/travel-explorer/hooks/use-explorer-data";
import { buildTripsFileName, getEnglishCountryName } from "@/lib/travel/trips-csv";
import type { CountryCode } from "@/types/geo.types";
import type { TravelRecord } from "@/types/travel.types";

/** Which trips a panel offers: one official's, a country's officials', or visits to a country. */
export type TripDownloadScope =
    | { kind: "official"; officialId: string }
    | { kind: "outbound"; countryCode: CountryCode }
    | { kind: "inbound"; countryCode: CountryCode };

export interface TripDownloads {
    all: TripDownload;
    filtered: TripDownload;
    /** The country's full records (purposes, sources) are still loading. */
    pending: boolean;
}

interface ScopeDetails {
    /** Country whose detail file holds the trips' purposes and sources, if any. */
    detailCountry: CountryCode | null;
    matches: (record: TravelRecord) => boolean;
    subject: string[];
}

/**
 * The files a map panel offers: the trips matching the current filters and all trips in scope.
 *
 * @param scope - Which trips the panel shows.
 * @returns Both downloads, or `null` for the fictional samples or when the scope has no trips.
 */
export const useTripDownloads = (scope: TripDownloadScope): TripDownloads | null => {
    const {
        allRecords,
        dataSource,
        detailStatus,
        officialById,
        recordsByDestination,
        recordsByOfficial,
        recordsByOrigin,
        updatedOn,
    } = useExplorerData();
    const scopeKey = scope.kind === "official" ? scope.officialId : scope.countryCode;
    const { kind } = scope;
    const detailCountry =
        kind === "official" ? (officialById.get(scopeKey)?.countryCode ?? null) : null;

    const details = useMemo((): ScopeDetails => {
        if (kind === "official") {
            return {
                detailCountry,
                matches: (record) => record.officialId === scopeKey,
                subject: [scopeKey, "trips"],
            };
        }
        const name = getEnglishCountryName(scopeKey);
        if (kind === "outbound") {
            return {
                detailCountry: scopeKey,
                matches: (record) => record.originCountryCode === scopeKey,
                subject: [name, "officials", "trips"],
            };
        }
        // Visitors come from many countries; their purposes appear only where already loaded.
        return {
            detailCountry: null,
            matches: (record) => record.destination.countryCode === scopeKey,
            subject: ["visits to", name],
        };
    }, [detailCountry, kind, scopeKey]);

    const all = useMemo(() => allRecords.filter(details.matches), [allRecords, details]);

    const filtered = useMemo(() => {
        const groups = {
            inbound: recordsByDestination,
            official: recordsByOfficial,
            outbound: recordsByOrigin,
        } as const;
        return groups[kind].get(scopeKey) ?? [];
    }, [kind, recordsByDestination, recordsByOfficial, recordsByOrigin, scopeKey]);

    return useMemo(() => {
        if (dataSource === "sample" || !updatedOn || all.length === 0) {
            return null;
        }
        const toDownload = (
            records: readonly TravelRecord[],
            isFiltered: boolean
        ): TripDownload => ({
            count: records.length,
            fileName: buildTripsFileName({
                filtered: isFiltered,
                subject: details.subject,
                updatedOn,
            }),
            load: () => ({ officialById, records }),
        });
        return {
            all: toDownload(all, false),
            filtered: toDownload(filtered, true),
            pending:
                details.detailCountry !== null &&
                detailStatus.get(details.detailCountry) === "loading",
        };
    }, [all, dataSource, detailStatus, details, filtered, officialById, updatedOn]);
};

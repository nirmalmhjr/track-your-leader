"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { DownloadTripsButton, type TripDownload } from "@/components/shared/download-trips-button";
import { compareNewestFirst } from "@/features/leaders/utils/leaders.utils";
import { travelDataClient } from "@/features/travel-explorer/data/travel-data-client";
import { buildTripsFileName, getEnglishCountryName } from "@/lib/travel/trips-csv";
import type { IsoDate, TrackedCountry } from "@/types/travel.types";

interface CountryDownloadButtonProps {
    country: TrackedCountry;
    today: IsoDate;
    /** Trips by the country's officials, as counted in the index. */
    tripCount: number;
    updatedOn: IsoDate;
}

/**
 * Saves every trip by the country's officials, current and former. The page only carries
 * summaries, so the country's full records are fetched when the visitor asks for the file.
 */
export function CountryDownloadButton({
    country,
    today,
    tripCount,
    updatedOn,
}: CountryDownloadButtonProps) {
    const t = useTranslations("Downloads");

    const download = useMemo<TripDownload>(
        () => ({
            count: tripCount,
            fileName: buildTripsFileName({
                filtered: false,
                subject: [getEnglishCountryName(country.code), "officials", "trips"],
                updatedOn,
            }),
            load: async () => {
                // Trips in a country file all start from that country.
                const detail = await travelDataClient.getCountry(
                    country.code,
                    new Map([[country.code, country]]),
                    today
                );
                return {
                    officialById: new Map(
                        detail.officials.map((official) => [official.id, official])
                    ),
                    records: detail.records.toSorted(compareNewestFirst),
                };
            },
        }),
        [country, today, tripCount, updatedOn]
    );

    return <DownloadTripsButton all={download} label={t("downloadTrips")} />;
}

"use client";

import { IconSearch } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { type ChangeEvent, useCallback, useState } from "react";

import { CountryFlag } from "@/components/shared/country-flag";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { StatList } from "@/features/travel-explorer/components/stat-list";
import { TravelStatusBadge } from "@/features/travel-explorer/components/travel-status";
import { OVERVIEW_UPCOMING_LIMIT } from "@/features/travel-explorer/constants/explorer.constants";
import { useExplorerData } from "@/features/travel-explorer/hooks/use-explorer-data";
import { useExplorerFormat } from "@/features/travel-explorer/hooks/use-explorer-format";
import { useExplorerState } from "@/features/travel-explorer/hooks/use-explorer-state";
import type { TrackedCountry, TravelRecord } from "@/features/travel-explorer/types/travel.types";
import { normalizeSearchText } from "@/features/travel-explorer/utils/filters.utils";
import {
    countTrips,
    isFutureStatus,
    summarizeTravel,
} from "@/features/travel-explorer/utils/travel-aggregates.utils";
import { getCountryReference } from "@/lib/geo/country-reference";
import { useExplorerUiStore } from "@/stores/explorer-ui-store";

function UpcomingTripRow({ record }: { record: TravelRecord }) {
    const format = useExplorerFormat();
    const { officialById, today } = useExplorerData();
    const { selectTrip } = useExplorerState();
    const official = officialById.get(record.officialId);
    const handleSelect = useCallback(() => selectTrip(record), [selectTrip, record]);

    return (
        <li>
            <button
                className="flex w-full items-start gap-3 rounded-md px-2 py-2 text-left outline-none transition-colors hover:bg-accent/50 focus-visible:ring-3 focus-visible:ring-ring/50"
                onClick={handleSelect}
                type="button"
            >
                <time
                    className="flex w-14 shrink-0 flex-col items-center rounded-md border py-1 text-center leading-tight"
                    dateTime={record.startDate}
                >
                    <span className="font-semibold text-sm tabular-nums">
                        {format.dayMonth(record.startDate)}
                    </span>
                </time>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate font-medium text-sm">{official?.fullName}</span>
                    <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground text-xs">
                        <CountryFlag
                            alpha2={getCountryReference(record.originCountryCode)?.alpha2}
                            size="sm"
                        />
                        <span aria-hidden>→</span>
                        <CountryFlag
                            alpha2={getCountryReference(record.destination.countryCode)?.alpha2}
                            size="sm"
                        />
                        <span className="truncate">
                            {record.destination.city}
                            {record.eventName ? ` · ${record.eventName}` : ""}
                        </span>
                    </span>
                    <span className="flex items-center gap-2 text-muted-foreground text-xs">
                        {format.relativeDays(record.startDate, today)}
                        {record.status === "planned" ? (
                            <TravelStatusBadge record={record} today={today} />
                        ) : null}
                    </span>
                </span>
            </button>
        </li>
    );
}

interface CountryRowProps {
    country: TrackedCountry;
    label: string;
    maxTrips: number;
    trips: number;
}

function CountryRow({ country, label, trips, maxTrips }: CountryRowProps) {
    const format = useExplorerFormat();
    const { selectCountry } = useExplorerState();
    const setHoveredCountry = useExplorerUiStore((state) => state.setHoveredCountry);
    const reference = getCountryReference(country.code);

    const handleSelect = useCallback(
        () => selectCountry(country.code),
        [selectCountry, country.code]
    );
    const handleHighlight = useCallback(
        () => setHoveredCountry(country.code),
        [setHoveredCountry, country.code]
    );
    const handleClearHighlight = useCallback(() => setHoveredCountry(null), [setHoveredCountry]);

    return (
        <li>
            <button
                className="grid w-full grid-cols-[auto_minmax(0,1fr)_4.5rem] items-center gap-x-3 rounded-md px-2 py-1.5 text-left outline-none transition-colors hover:bg-accent/50 focus-visible:ring-3 focus-visible:ring-ring/50"
                onBlur={handleClearHighlight}
                onClick={handleSelect}
                onFocus={handleHighlight}
                onPointerEnter={handleHighlight}
                onPointerLeave={handleClearHighlight}
                type="button"
            >
                <CountryFlag alpha2={reference?.alpha2} />
                <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm">{label}</span>
                    <span className="truncate text-muted-foreground text-xs">
                        {country.capital.city}
                    </span>
                </span>
                <span className="flex flex-col items-end gap-1">
                    <span className="text-sm tabular-nums">{format.number(trips)}</span>
                    <span aria-hidden className="h-1 w-full overflow-hidden rounded-full bg-muted">
                        <span
                            className="block h-full rounded-full bg-map-seq-4"
                            style={{ width: `${(trips / maxTrips) * 100}%` }}
                        />
                    </span>
                </span>
            </button>
        </li>
    );
}

/** Landing state of the panel: global figures, the country index and what's coming up. */
export function OverviewView() {
    const t = useTranslations("Explorer.overview");
    const format = useExplorerFormat();
    const { countries, matchingOfficialIds, matchingRecords, today } = useExplorerData();
    const [query, setQuery] = useState("");
    const handleQueryChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value),
        []
    );

    const summary = summarizeTravel(matchingRecords);
    const tripsByCountry = countTrips(matchingRecords, (record) => record.originCountryCode);
    const maxTrips = Math.max(1, ...tripsByCountry.values());
    const normalizedQuery = normalizeSearchText(query);

    const countryRows = countries
        .map((country) => ({
            country,
            label: format.countryName(country.code),
            trips: tripsByCountry.get(country.code) ?? 0,
        }))
        .filter(
            (row) =>
                !normalizedQuery ||
                normalizeSearchText(row.label).includes(normalizedQuery) ||
                normalizeSearchText(row.country.name).includes(normalizedQuery)
        )
        .sort((a, b) => b.trips - a.trips || a.label.localeCompare(b.label));

    const upcoming = matchingRecords
        .filter((record) => isFutureStatus(record.status) && record.endDate >= today)
        .sort((a, b) => a.startDate.localeCompare(b.startDate))
        .slice(0, OVERVIEW_UPCOMING_LIMIT);

    return (
        <div className="flex flex-col gap-6 p-4">
            <section className="flex flex-col gap-1">
                <h2 className="font-semibold text-base">{t("title")}</h2>
                <p className="text-muted-foreground text-sm">{t("description")}</p>
            </section>

            <StatList
                items={[
                    { label: t("stats.countries"), value: format.number(countries.length) },
                    { label: t("stats.officials"), value: format.number(matchingOfficialIds.size) },
                    { label: t("stats.trips"), value: format.number(summary.tripCount) },
                    { label: t("stats.upcoming"), value: format.number(summary.upcomingCount) },
                ]}
            />

            <section aria-labelledby="overview-countries" className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-medium text-sm" id="overview-countries">
                        {t("countriesTitle")}
                    </h3>
                    <span className="text-muted-foreground text-xs">{t("tripsColumn")}</span>
                </div>
                <InputGroup>
                    <InputGroupAddon>
                        <IconSearch aria-hidden />
                    </InputGroupAddon>
                    <InputGroupInput
                        aria-label={t("countrySearch")}
                        onChange={handleQueryChange}
                        placeholder={t("countrySearch")}
                        type="search"
                        value={query}
                    />
                </InputGroup>
                {countryRows.length === 0 ? (
                    <p className="px-2 text-muted-foreground text-sm">{t("noCountryMatch")}</p>
                ) : (
                    <ul className="-mx-2 flex flex-col">
                        {countryRows.map(({ country, label, trips }) => (
                            <CountryRow
                                country={country}
                                key={country.code}
                                label={label}
                                maxTrips={maxTrips}
                                trips={trips}
                            />
                        ))}
                    </ul>
                )}
                <p className="text-muted-foreground text-xs">{t("untrackedHint")}</p>
            </section>

            <section aria-labelledby="overview-upcoming" className="flex flex-col gap-2">
                <h3 className="font-medium text-sm" id="overview-upcoming">
                    {t("upcomingTitle")}
                </h3>
                {upcoming.length === 0 ? (
                    <Empty className="border p-6">
                        <EmptyHeader>
                            <EmptyTitle className="text-sm">{t("noUpcomingTitle")}</EmptyTitle>
                            <EmptyDescription>{t("noUpcomingDescription")}</EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                ) : (
                    <ul className="-mx-2 flex flex-col">
                        {upcoming.map((record) => (
                            <UpcomingTripRow key={record.id} record={record} />
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}

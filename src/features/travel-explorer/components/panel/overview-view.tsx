"use client";

import { IconSearch } from "@tabler/icons-react";
import { useLocale, useTranslations } from "next-intl";
import { type ChangeEvent, useCallback, useMemo, useState } from "react";

import { CountryFlag } from "@/components/shared/country-flag";
import { TravelStatusBadge } from "@/components/shared/travel-status";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { DataStatus } from "@/features/travel-explorer/components/panel/data-status";
import { StatList } from "@/features/travel-explorer/components/stat-list";
import {
    COUNTRY_SORTS,
    OVERVIEW_UPCOMING_LIMIT,
} from "@/features/travel-explorer/constants/explorer.constants";
import { useExplorerData } from "@/features/travel-explorer/hooks/use-explorer-data";
import { useExplorerState } from "@/features/travel-explorer/hooks/use-explorer-state";
import { useHoverHighlight } from "@/features/travel-explorer/hooks/use-hover-highlight";
import { useOpenCountry } from "@/features/travel-explorer/hooks/use-open-country";
import type { CountrySort } from "@/features/travel-explorer/types/explorer.types";
import { useTravelFormat } from "@/hooks/use-travel-format";
import { getCountryReference } from "@/lib/geo/country-reference";
import { getCountrySearchTerms } from "@/lib/geo/country-search-terms";
import { createSearchEntry, rankSearchEntry } from "@/lib/travel/search.utils";
import { isFutureStatus } from "@/lib/travel/travel-summary.utils";
import { normalizeSearchText } from "@/lib/utils";
import { useExplorerUiStore } from "@/stores/explorer-ui-store";
import type { TrackedCountry, TravelRecord } from "@/types/travel.types";

function UpcomingTripRow({ record }: { record: TravelRecord }) {
    const format = useTravelFormat();
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
                        {format.tripStartShort(record)}
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
                            {format.placeName(record.destination)}
                            {record.eventName ? ` · ${record.eventName}` : ""}
                        </span>
                    </span>
                    <span className="flex items-center gap-2 text-muted-foreground text-xs">
                        {/* "284 days ago" would count from 1 January for a trip known only by year. */}
                        {record.datePrecision === "day"
                            ? format.relativeDays(record.startDate, today)
                            : null}
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

type CountryRowData = Omit<CountryRowProps, "maxTrips">;

/** Comparators for the country index, given a collator for the active locale. */
const createCountrySorters = (
    collator: Intl.Collator
): Readonly<Record<CountrySort, (a: CountryRowData, b: CountryRowData) => number>> => ({
    name: (a, b) => collator.compare(a.label, b.label),
    trips: (a, b) => b.trips - a.trips || collator.compare(a.label, b.label),
});

function CountryRow({ country, label, trips, maxTrips }: CountryRowProps) {
    const t = useTranslations("Explorer.overview");
    const format = useTravelFormat();
    const openCountry = useOpenCountry();
    const setHoveredCountry = useExplorerUiStore((state) => state.setHoveredCountry);
    const reference = getCountryReference(country.code);

    const handleSelect = useCallback(() => openCountry(country.code), [openCountry, country.code]);
    const highlightHandlers = useHoverHighlight(setHoveredCountry, country.code);

    // Rows out of view are skipped until scrolled near, so the long list doesn't fetch every
    // country's flag on load. 48px is a row's height (two lines of text plus padding).
    return (
        <li className="[contain-intrinsic-size:auto_48px] [content-visibility:auto]">
            <button
                className="grid w-full grid-cols-[auto_minmax(0,1fr)_4.5rem] items-center gap-x-3 rounded-md px-2 py-1.5 text-left outline-none transition-colors hover:bg-accent/50 focus-visible:ring-3 focus-visible:ring-ring/50"
                onClick={handleSelect}
                type="button"
                {...highlightHandlers}
            >
                <CountryFlag alpha2={reference?.alpha2} />
                <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm">{label}</span>
                    <span className="truncate text-muted-foreground text-xs">
                        {country.capital.city}
                    </span>
                </span>
                <span className="flex flex-col items-end gap-1">
                    <span className="text-sm tabular-nums">
                        {format.number(trips)}
                        <span className="sr-only"> {t("tripsColumn")}</span>
                    </span>
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
    const locale = useLocale();
    const format = useTravelFormat();
    const { countries, matchingRecords, status, today, worldStats } = useExplorerData();
    const [query, setQuery] = useState("");
    const handleQueryChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value),
        []
    );
    const countrySort = useExplorerUiStore((state) => state.countrySort);
    const setCountrySort = useExplorerUiStore((state) => state.setCountrySort);
    const handleSortChange = useCallback(
        (value: string | null) => {
            const next = COUNTRY_SORTS.find((candidate) => candidate === value);
            if (next) {
                setCountrySort(next);
            }
        },
        [setCountrySort]
    );
    const countrySorters = useMemo(
        () => createCountrySorters(new Intl.Collator(locale, { sensitivity: "base" })),
        [locale]
    );

    const countryEntries = useMemo(
        () =>
            countries.map((country) => {
                const label = format.countryName(country.code);
                return createSearchEntry({ country, label }, label, [
                    country.name,
                    ...getCountrySearchTerms(country.code),
                ]);
            }),
        [countries, format]
    );

    const tripsByCountry = worldStats?.tripsByOrigin;
    const maxTrips = Math.max(1, ...(tripsByCountry?.values() ?? []));
    const normalizedQuery = normalizeSearchText(query);

    // Codes and abbreviations ("NPL", "UK", "UAE") find a country as well as its name; with a
    // query, the best matches come first and the chosen order breaks ties.
    const countryRows = countryEntries
        .flatMap((entry) => {
            const rank = normalizedQuery ? rankSearchEntry(entry, normalizedQuery) : 0;
            if (rank === null) {
                return [];
            }
            const { country, label } = entry.item;
            const row: CountryRowData = {
                country,
                label,
                trips: tripsByCountry?.get(country.code) ?? 0,
            };
            return [{ rank, row }];
        })
        .sort((a, b) => a.rank - b.rank || countrySorters[countrySort](a.row, b.row))
        .map(({ row }) => row);
    const sortItems = COUNTRY_SORTS.map((value) => ({ label: t(`countrySort.${value}`), value }));

    const upcoming = matchingRecords
        .filter((record) => isFutureStatus(record.status) && record.endDate >= today)
        // Trips with a date come first, soonest first; those known only by month or year follow.
        .sort(
            (a, b) =>
                Number(a.datePrecision !== "day") - Number(b.datePrecision !== "day") ||
                a.startDate.localeCompare(b.startDate)
        )
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
                    {
                        label: t("stats.officials"),
                        value: format.number(worldStats?.officialCount ?? 0),
                    },
                    { label: t("stats.trips"), value: format.number(worldStats?.tripCount ?? 0) },
                    {
                        label: t("stats.upcoming"),
                        value: format.number(worldStats?.upcomingCount ?? 0),
                    },
                ]}
            />

            <section aria-labelledby="overview-countries" className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                    <h3 className="font-medium text-sm" id="overview-countries">
                        {t("countriesTitle")}
                    </h3>
                    <Select items={sortItems} onValueChange={handleSortChange} value={countrySort}>
                        <SelectTrigger aria-label={t("countrySort.label")} size="sm">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent align="end">
                            <SelectGroup>
                                {sortItems.map((item) => (
                                    <SelectItem key={item.value} value={item.value}>
                                        {item.label}
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
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
                {/* The upcoming trips themselves arrive with the full data, after the summary. */}
                {status === "ready" ? null : <DataStatus />}
                {status === "ready" && upcoming.length === 0 ? (
                    <Empty className="border p-6">
                        <EmptyHeader>
                            <EmptyTitle className="text-sm">{t("noUpcomingTitle")}</EmptyTitle>
                            <EmptyDescription>{t("noUpcomingDescription")}</EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                ) : null}
                {upcoming.length > 0 ? (
                    <ul className="-mx-2 flex flex-col">
                        {upcoming.map((record) => (
                            <UpcomingTripRow key={record.id} record={record} />
                        ))}
                    </ul>
                ) : null}
            </section>
        </div>
    );
}

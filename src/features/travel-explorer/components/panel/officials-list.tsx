"use client";

import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";

import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { OfficialCard } from "@/features/travel-explorer/components/official-card";
import { ClearFiltersEmpty } from "@/features/travel-explorer/components/panel/clear-filters-empty";
import { ShowMoreButton } from "@/features/travel-explorer/components/panel/show-more-button";
import {
    OFFICIAL_GROUPS,
    OFFICIAL_SORTS,
} from "@/features/travel-explorer/constants/explorer.constants";
import { useExplorerData } from "@/features/travel-explorer/hooks/use-explorer-data";
import { useExplorerFormat } from "@/features/travel-explorer/hooks/use-explorer-format";
import { useExplorerState } from "@/features/travel-explorer/hooks/use-explorer-state";
import type {
    OfficialGroup,
    OfficialSort,
    TravelSummary,
} from "@/features/travel-explorer/types/explorer.types";
import type { Official } from "@/features/travel-explorer/types/travel.types";
import { getOfficialGroup, getOfficialRank } from "@/features/travel-explorer/utils/filters.utils";
import { summarizeTravel } from "@/features/travel-explorer/utils/travel-aggregates.utils";
import type { CountryCode } from "@/types/geo.types";

interface OfficialRow {
    official: Official;
    summary: TravelSummary;
}

const SORTERS: Readonly<Record<OfficialSort, (a: OfficialRow, b: OfficialRow) => number>> = {
    name: (a, b) => a.official.fullName.localeCompare(b.official.fullName),
    rank: (a, b) =>
        getOfficialRank(a.official) - getOfficialRank(b.official) ||
        b.summary.tripCount - a.summary.tripCount,
    recent: (a, b) =>
        (b.summary.lastTrip?.startDate ?? "").localeCompare(a.summary.lastTrip?.startDate ?? ""),
    trips: (a, b) => b.summary.tripCount - a.summary.tripCount,
};

/** Cards rendered per page; long lists (every official since 1945) grow as they scroll. */
const PAGE_SIZE = 30;

interface RowGroup {
    group: OfficialGroup | null;
    rows: OfficialRow[];
}

/** The first `limit` rows, keeping their groups. */
const takeRows = (groups: readonly RowGroup[], limit: number): RowGroup[] => {
    const taken: RowGroup[] = [];
    let remaining = limit;
    for (const entry of groups) {
        if (remaining <= 0) {
            break;
        }
        taken.push({ group: entry.group, rows: entry.rows.slice(0, remaining) });
        remaining -= entry.rows.length;
    }
    return taken;
};

/** Officials of a country matching the filters, grouped by seniority or sorted on demand. */
export function OfficialsList({ countryCode }: { countryCode: CountryCode }) {
    const t = useTranslations("Explorer");
    const format = useExplorerFormat();
    const { matchingOfficialIds, officialsByCountry, recordsByOfficial, travelFiltersActive } =
        useExplorerData();
    const { selectOfficial } = useExplorerState();
    const [sort, setSort] = useState<OfficialSort>("rank");
    const handleSortChange = useCallback((value: string | null) => {
        const next = OFFICIAL_SORTS.find((candidate) => candidate === value);
        if (next) {
            setSort(next);
        }
    }, []);

    const rows = useMemo(
        () =>
            (officialsByCountry.get(countryCode) ?? [])
                .filter((official) => matchingOfficialIds.has(official.id))
                .map(
                    (official): OfficialRow => ({
                        official,
                        summary: summarizeTravel(recordsByOfficial.get(official.id) ?? []),
                    })
                )
                // When trip filters are active, only officials with matching trips are relevant.
                .filter((row) => !travelFiltersActive || recordsByOfficial.has(row.official.id))
                .sort(SORTERS[sort]),
        [
            countryCode,
            matchingOfficialIds,
            officialsByCountry,
            recordsByOfficial,
            sort,
            travelFiltersActive,
        ]
    );

    // Another country or order starts again from the first page.
    const pageKey = `${countryCode}|${sort}`;
    const [page, setPage] = useState({ key: pageKey, limit: PAGE_SIZE });
    const limit = page.key === pageKey ? page.limit : PAGE_SIZE;
    const showMore = useCallback(
        () =>
            setPage((current) => ({
                key: pageKey,
                limit: (current.key === pageKey ? current.limit : PAGE_SIZE) + PAGE_SIZE,
            })),
        [pageKey]
    );

    if (rows.length === 0) {
        return (
            <ClearFiltersEmpty
                description={t("country.noOfficialsDescription")}
                title={t("country.noOfficialsTitle")}
            />
        );
    }

    const sortItems = OFFICIAL_SORTS.map((value) => ({ label: t(`sort.${value}`), value }));
    const groups: RowGroup[] =
        sort === "rank"
            ? OFFICIAL_GROUPS.map((group) => ({
                  group,
                  rows: rows.filter((row) => getOfficialGroup(row.official) === group),
              })).filter((entry) => entry.rows.length > 0)
            : [{ group: null, rows }];
    const hiddenCount = Math.max(rows.length - limit, 0);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
                <p className="text-muted-foreground text-xs">
                    {t("country.officialsCount", {
                        count: rows.length,
                        countLabel: format.number(rows.length),
                    })}
                </p>
                <Select items={sortItems} onValueChange={handleSortChange} value={sort}>
                    <SelectTrigger aria-label={t("sort.label")} size="sm">
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

            {takeRows(groups, limit).map(({ group, rows: groupRows }) => (
                <section
                    aria-label={group ? t(`roleGroups.${group}`) : undefined}
                    className="flex flex-col gap-2"
                    key={group ?? "all"}
                >
                    {group ? (
                        <h3 className="font-medium text-muted-foreground text-xs">
                            {t(`roleGroups.${group}`)}
                        </h3>
                    ) : null}
                    <ul className="flex flex-col gap-2">
                        {groupRows.map((row) => (
                            <li key={row.official.id}>
                                <OfficialCard
                                    official={row.official}
                                    onSelect={selectOfficial}
                                    summary={row.summary}
                                />
                            </li>
                        ))}
                    </ul>
                </section>
            ))}

            {hiddenCount > 0 ? (
                <ShowMoreButton
                    label={t("country.showMore", {
                        count: Math.min(hiddenCount, PAGE_SIZE),
                        countLabel: format.number(Math.min(hiddenCount, PAGE_SIZE)),
                    })}
                    onShowMore={showMore}
                    shownCount={limit}
                />
            ) : null}
        </div>
    );
}

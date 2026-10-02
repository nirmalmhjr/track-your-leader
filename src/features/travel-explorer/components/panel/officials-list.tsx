"use client";

import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";

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
import {
    OFFICIAL_GROUPS,
    OFFICIAL_SORTS,
} from "@/features/travel-explorer/constants/explorer.constants";
import { useExplorerData } from "@/features/travel-explorer/hooks/use-explorer-data";
import { useExplorerFormat } from "@/features/travel-explorer/hooks/use-explorer-format";
import { useExplorerState } from "@/features/travel-explorer/hooks/use-explorer-state";
import type { OfficialSort, TravelSummary } from "@/features/travel-explorer/types/explorer.types";
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

    const rows: OfficialRow[] = (officialsByCountry.get(countryCode) ?? [])
        .filter((official) => matchingOfficialIds.has(official.id))
        .map((official) => ({
            official,
            summary: summarizeTravel(recordsByOfficial.get(official.id) ?? []),
        }))
        // When trip filters are active, only officials with matching trips are relevant.
        .filter((row) => !travelFiltersActive || recordsByOfficial.has(row.official.id))
        .sort(SORTERS[sort]);

    if (rows.length === 0) {
        return (
            <ClearFiltersEmpty
                description={t("country.noOfficialsDescription")}
                title={t("country.noOfficialsTitle")}
            />
        );
    }

    const sortItems = OFFICIAL_SORTS.map((value) => ({ label: t(`sort.${value}`), value }));
    const groups =
        sort === "rank"
            ? OFFICIAL_GROUPS.map((group) => ({
                  group,
                  rows: rows.filter((row) => getOfficialGroup(row.official) === group),
              })).filter((entry) => entry.rows.length > 0)
            : [{ group: null, rows }];

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

            {groups.map(({ group, rows: groupRows }) => (
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
        </div>
    );
}

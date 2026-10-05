"use client";

import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";

import { ShowMoreButton } from "@/components/shared/show-more-button";
import { OfficialCard } from "@/features/travel-explorer/components/official-card";
import { useExplorerData } from "@/features/travel-explorer/hooks/use-explorer-data";
import { useExplorerState } from "@/features/travel-explorer/hooks/use-explorer-state";
import type { OfficialSort } from "@/features/travel-explorer/types/explorer.types";
import { getOfficialGroup } from "@/features/travel-explorer/utils/filters.utils";
import { useTravelFormat } from "@/hooks/use-travel-format";
import { getOfficialRank } from "@/lib/travel/officials.utils";
import { OFFICIAL_GROUPS } from "@/lib/travel/travel.constants";
import { summarizeTravel } from "@/lib/travel/travel-summary.utils";
import type { CountryCode } from "@/types/geo.types";
import type { Official, OfficialGroup, TravelSummary } from "@/types/travel.types";

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

interface OfficialsListProps {
    countryCode: CountryCode;
    officials: readonly Official[];
    sort: OfficialSort;
}

/** Officials of a country matching the filters, grouped by seniority or sorted on demand. */
export function OfficialsList({ countryCode, officials, sort }: OfficialsListProps) {
    const t = useTranslations("Explorer");
    const format = useTravelFormat();
    const { recordsByOfficial } = useExplorerData();
    const { selectOfficial } = useExplorerState();

    const rows = useMemo(
        () =>
            officials
                .map(
                    (official): OfficialRow => ({
                        official,
                        summary: summarizeTravel(recordsByOfficial.get(official.id) ?? []),
                    })
                )
                .sort(SORTERS[sort]),
        [officials, recordsByOfficial, sort]
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

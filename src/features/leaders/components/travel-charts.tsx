"use client";

import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";

import { CountryFlag } from "@/components/shared/country-flag";
import { Button } from "@/components/ui/button";
import { useDirectoryFormat } from "@/features/leaders/hooks/use-directory-format";
import type { DestinationCount, YearCount } from "@/features/leaders/types/leaders.types";
import { getCountryReference } from "@/lib/geo/country-reference";
import { cn } from "@/lib/utils";

/** The columns grow with their card; this keeps them readable when the card is short. */
const CHART_MIN_HEIGHT_PX = 128;

/** Chart card: title, the chart, and a table twin so no value depends on hovering. */
function ChartCard({
    title,
    id,
    table,
    children,
}: {
    children: React.ReactNode;
    id: string;
    table: React.ReactNode;
    title: string;
}) {
    const t = useTranslations("Leaders.profile");
    const [isTableShown, setTableShown] = useState(false);
    const toggle = useCallback(() => setTableShown((shown) => !shown), []);

    return (
        <figure
            aria-labelledby={id}
            className="flex h-full flex-col gap-4 rounded-xl border bg-card p-4"
        >
            <div className="flex items-center justify-between gap-3">
                <figcaption className="font-medium text-sm" id={id}>
                    {title}
                </figcaption>
                <Button aria-expanded={isTableShown} onClick={toggle} size="xs" variant="ghost">
                    {isTableShown ? t("hideTable") : t("showTable")}
                </Button>
            </div>
            {isTableShown ? table : children}
        </figure>
    );
}

/** Trips per calendar year as columns rising from one baseline. */
export function TripsPerYearChart({ years }: { years: readonly YearCount[] }) {
    const t = useTranslations("Leaders.profile");
    const format = useDirectoryFormat();
    const [first] = years;
    const peak = years.reduce((best, entry) => (entry.count > best.count ? entry : best), first);
    const last = years.at(-1) ?? first;

    const table = (
        <table className="w-full text-sm">
            <thead className="text-muted-foreground text-xs">
                <tr>
                    <th className="py-1 text-left font-normal">{t("yearColumn")}</th>
                    <th className="py-1 text-right font-normal">{t("tripsColumn")}</th>
                </tr>
            </thead>
            <tbody className="divide-y">
                {years.toReversed().map((entry) => (
                    <tr key={entry.year}>
                        <td className="py-1 tabular-nums">{format.year(entry.year)}</td>
                        <td className="py-1 text-right tabular-nums">
                            {format.number(entry.count)}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );

    return (
        <ChartCard id="trips-per-year" table={table} title={t("tripsPerYear")}>
            <div
                aria-label={t("tripsPerYearSummary", {
                    first: format.year(first.year),
                    last: format.year(last.year),
                    peakLabel: format.number(peak.count),
                    peakYear: format.year(peak.year),
                })}
                className="flex flex-1 flex-col gap-1.5"
                role="img"
            >
                <div
                    className="flex flex-1 items-end justify-center gap-[2px] border-b pt-5"
                    style={{ minHeight: CHART_MIN_HEIGHT_PX }}
                >
                    {years.map((entry) => {
                        const isPeak = entry === peak;
                        const height = peak.count === 0 ? 0 : (entry.count / peak.count) * 100;
                        return (
                            // Each column's hit area spans the full chart height, not just the bar.
                            <div
                                className="group relative flex h-full max-w-6 flex-1 flex-col items-center justify-end"
                                key={entry.year}
                            >
                                <div
                                    className={cn(
                                        "w-full rounded-t-[4px] bg-travel-completed transition-opacity group-hover:opacity-70",
                                        entry.count === 0 && "bg-transparent"
                                    )}
                                    style={{ height: `${height}%` }}
                                />
                                {isPeak ? (
                                    <span
                                        className="absolute left-1/2 mb-1 -translate-x-1/2 text-[11px] text-muted-foreground tabular-nums"
                                        style={{ bottom: `${height}%` }}
                                    >
                                        {format.number(entry.count)}
                                    </span>
                                ) : null}
                                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-popover-foreground text-xs shadow-md group-hover:block">
                                    <span className="font-semibold">
                                        {format.number(entry.count)}
                                    </span>
                                    <span className="text-muted-foreground">
                                        {" "}
                                        · {format.year(entry.year)}
                                    </span>
                                </span>
                            </div>
                        );
                    })}
                </div>
                <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
                    <span>{format.year(first.year)}</span>
                    {last.year === first.year ? null : <span>{format.year(last.year)}</span>}
                </div>
            </div>
        </ChartCard>
    );
}

/** The countries visited most, as a ranked list of horizontal bars. */
export function TopDestinationsChart({
    destinations,
}: {
    destinations: readonly DestinationCount[];
}) {
    const t = useTranslations("Leaders.profile");
    const format = useDirectoryFormat();
    const max = destinations[0]?.count ?? 0;

    const table = (
        <table className="w-full text-sm">
            <thead className="text-muted-foreground text-xs">
                <tr>
                    <th className="py-1 text-left font-normal">{t("countryColumn")}</th>
                    <th className="py-1 text-right font-normal">{t("tripsColumn")}</th>
                </tr>
            </thead>
            <tbody className="divide-y">
                {destinations.map((entry) => (
                    <tr key={entry.countryCode}>
                        <td className="py-1">{format.countryName(entry.countryCode)}</td>
                        <td className="py-1 text-right tabular-nums">
                            {format.number(entry.count)}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );

    return (
        <ChartCard id="top-destinations" table={table} title={t("topDestinations")}>
            <ol className="flex flex-col gap-2.5">
                {destinations.map((entry) => (
                    <li
                        className="grid grid-cols-[minmax(0,9rem)_1fr_2rem] items-center gap-3 text-sm"
                        key={entry.countryCode}
                    >
                        <span className="flex min-w-0 items-center gap-2">
                            <CountryFlag
                                alpha2={getCountryReference(entry.countryCode)?.alpha2}
                                size="sm"
                            />
                            <span className="truncate">
                                {format.countryName(entry.countryCode)}
                            </span>
                        </span>
                        <span className="h-2.5 rounded-r-[4px] bg-muted/60">
                            <span
                                className="block h-full rounded-r-[4px] bg-travel-completed"
                                style={{ width: `${(entry.count / max) * 100}%` }}
                            />
                        </span>
                        <span className="text-right text-muted-foreground text-xs tabular-nums">
                            {format.number(entry.count)}
                        </span>
                    </li>
                ))}
            </ol>
        </ChartCard>
    );
}

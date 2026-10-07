"use client";

import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";

import { OfficialAvatar } from "@/components/shared/official-avatar";
import { ShowMoreButton } from "@/components/shared/show-more-button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { ROUTES } from "@/configs/routes";
import { NotRecorded } from "@/features/leaders/components/not-recorded";
import { PartyChip } from "@/features/leaders/components/party-chip";
import type { LeaderEntry, PartyColors } from "@/features/leaders/types/leaders.types";
import { useTravelFormat } from "@/hooks/use-travel-format";
import { Link } from "@/i18n/navigation";
import { getTermYears } from "@/lib/travel/offices.utils";
import {
    getOtherCurrentPositions,
    getPortfolioName,
    getPrimaryPosition,
} from "@/lib/travel/officials.utils";
import { cn } from "@/lib/utils";
import type { TravelSummary } from "@/types/travel.types";

/** Ministers rendered per page; most cabinets fit on one. */
const PAGE_SIZE = 30;

/**
 * The table lays out by its own width, not the viewport's: beside the country rail a tablet
 * leaves it too narrow for five columns. Below `@2xl` (42rem) each row stacks instead.
 */
const CELL = "px-3 py-2.5 @max-2xl:p-0";

/** "● Last · China · June 2026": the latest trip, or the next one when none is completed yet. */
function LatestTrip({ className, summary }: { className?: string; summary: TravelSummary }) {
    const tCard = useTranslations("Leaders.card");
    const format = useTravelFormat();
    const record = summary.lastTrip ?? summary.nextTrip;
    if (!record) {
        return null;
    }
    const isNext = !summary.lastTrip;

    return (
        <span
            className={cn(
                "flex min-w-0 max-w-full items-center gap-1.5 text-muted-foreground text-xs",
                className
            )}
        >
            <span
                aria-hidden
                className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    isNext ? "border border-travel-upcoming bg-transparent" : "bg-travel-completed"
                )}
            />
            <span className="truncate">
                <span className="font-medium text-foreground">
                    {tCard(isNext ? "next" : "last")}
                </span>{" "}
                · {format.placeName(record.destination)} · {format.monthYear(record.startDate)}
            </span>
        </span>
    );
}

function CabinetRow({ entry, partyColors }: { entry: LeaderEntry; partyColors: PartyColors }) {
    const tCard = useTranslations("Leaders.card");
    const format = useTravelFormat();
    const { official, summary } = entry;
    const position = getPrimaryPosition(official);
    const others = getOtherCurrentPositions(official);
    const { start } = getTermYears(position);
    const since = start ? format.year(start) : null;

    return (
        <TableRow className="@max-2xl:grid @max-2xl:grid-cols-[minmax(0,1fr)_auto] @max-2xl:gap-x-3 @max-2xl:gap-y-1.5 @max-2xl:p-3">
            <TableCell className={cn(CELL, "@max-2xl:col-start-1 @max-2xl:whitespace-normal")}>
                <div className="flex min-w-0 items-center gap-2">
                    <OfficialAvatar official={official} size="sm" />
                    <Link
                        className="truncate rounded-sm font-medium outline-none hover:underline hover:underline-offset-2 focus-visible:ring-3 focus-visible:ring-ring/50"
                        href={ROUTES.leadersProfile(official.countryCode, official.id)}
                    >
                        {official.fullName}
                    </Link>
                </div>
                {official.party || since ? (
                    <div className="mt-1.5 flex @2xl:hidden flex-wrap items-center gap-2 text-muted-foreground text-xs">
                        {official.party ? (
                            <PartyChip colors={partyColors} party={official.party} />
                        ) : null}
                        {since ? (
                            <span className="tabular-nums">{tCard("since", { year: since })}</span>
                        ) : null}
                    </div>
                ) : null}
            </TableCell>
            <TableCell className={cn(CELL, "@max-2xl:col-span-2 @2xl:w-[38%] whitespace-normal")}>
                <span className="font-medium">{getPortfolioName(position.title)}</span>
                {others.length > 0 ? (
                    <span className="block text-muted-foreground text-xs">
                        {tCard("also")}{" "}
                        {others.map((other) => getPortfolioName(other.title)).join(" · ")}
                    </span>
                ) : null}
                {/* Stacked, the trip gets its own line under the portfolio, as on the cards. */}
                <LatestTrip className="mt-1.5 @2xl:hidden" summary={summary} />
            </TableCell>

            <TableCell className={cn(CELL, "@max-2xl:hidden")}>
                {official.party ? (
                    <PartyChip colors={partyColors} party={official.party} />
                ) : (
                    <NotRecorded />
                )}
            </TableCell>
            <TableCell className={cn(CELL, "@max-2xl:hidden tabular-nums")}>
                {since ?? <NotRecorded />}
            </TableCell>
            <TableCell className={cn(CELL, "@max-2xl:col-start-2 @max-2xl:row-start-1 text-right")}>
                <div className="flex min-w-0 flex-col items-end gap-0.5">
                    <span
                        className={cn(
                            "font-semibold tabular-nums",
                            summary.tripCount === 0 && "font-normal text-muted-foreground"
                        )}
                    >
                        {format.number(summary.tripCount)}
                    </span>
                    <LatestTrip className="@max-2xl:hidden justify-end" summary={summary} />
                </div>
            </TableCell>
        </TableRow>
    );
}

interface CabinetTableProps {
    entries: readonly LeaderEntry[];
    partyColors: PartyColors;
}

/**
 * The cabinet as a table to scan by portfolio and party. When narrow each row stacks into the
 * minister with their party, start year and trip count, then the portfolio and latest trip.
 */
export function CabinetTable({ entries, partyColors }: CabinetTableProps) {
    const t = useTranslations("Leaders.country");
    const tColumns = useTranslations("Leaders.country.cabinetColumns");
    const format = useTravelFormat();
    const [shown, setShown] = useState(PAGE_SIZE);
    const showMore = useCallback(() => setShown((count) => count + PAGE_SIZE), []);
    const remaining = entries.length - shown;
    const headClass = "h-9 px-3 font-medium text-muted-foreground text-xs";

    return (
        <div className="@container flex flex-col gap-2">
            <div className="overflow-hidden rounded-xl border bg-card">
                <Table>
                    <TableHeader className="@max-2xl:sr-only bg-muted/50">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className={headClass} scope="col">
                                {tColumns("minister")}
                            </TableHead>
                            <TableHead className={headClass} scope="col">
                                {tColumns("portfolio")}
                            </TableHead>

                            <TableHead className={headClass} scope="col">
                                {tColumns("party")}
                            </TableHead>
                            <TableHead className={headClass} scope="col">
                                {tColumns("since")}
                            </TableHead>
                            <TableHead className={cn(headClass, "text-right")} scope="col">
                                {tColumns("trips")}
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {entries.slice(0, shown).map((entry) => (
                            <CabinetRow
                                entry={entry}
                                key={entry.official.id}
                                partyColors={partyColors}
                            />
                        ))}
                    </TableBody>
                </Table>
            </div>
            {remaining > 0 ? (
                <ShowMoreButton
                    label={t("showMoreMinisters", {
                        count: Math.min(remaining, PAGE_SIZE),
                        countLabel: format.number(Math.min(remaining, PAGE_SIZE)),
                    })}
                    onShowMore={showMore}
                    shownCount={shown}
                />
            ) : null}
        </div>
    );
}

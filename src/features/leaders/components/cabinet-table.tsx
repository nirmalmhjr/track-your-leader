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

const CELL = "px-3 py-2.5 max-sm:p-0";

function TripsCell({ summary }: { summary: TravelSummary }) {
    const t = useTranslations("Leaders.country");
    const format = useTravelFormat();
    const record = summary.lastTrip ?? summary.nextTrip;

    return (
        <div className="flex flex-col items-end gap-0.5">
            <span
                className={cn(
                    "font-semibold tabular-nums",
                    summary.tripCount === 0 && "font-normal text-muted-foreground"
                )}
            >
                {format.number(summary.tripCount)}
            </span>
            {record ? (
                <span className="text-muted-foreground text-xs">
                    <span aria-hidden>
                        {format.placeName(record.destination)} ·{" "}
                        {format.monthYear(record.startDate)}
                    </span>
                    <span className="sr-only">
                        {t(summary.lastTrip ? "lastTrip" : "nextTrip", {
                            date: format.monthYear(record.startDate),
                            place: format.placeName(record.destination),
                        })}
                    </span>
                </span>
            ) : null}
        </div>
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
        <TableRow className="max-sm:grid max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:gap-x-3 max-sm:gap-y-1.5 max-sm:p-3">
            <TableCell className={cn(CELL, "whitespace-normal sm:w-[38%]")}>
                <span className="font-medium">{getPortfolioName(position.title)}</span>
                {others.length > 0 ? (
                    <span className="block text-muted-foreground text-xs">
                        {tCard("also")}{" "}
                        {others.map((other) => getPortfolioName(other.title)).join(" · ")}
                    </span>
                ) : null}
            </TableCell>
            <TableCell className={cn(CELL, "max-sm:col-start-1 max-sm:whitespace-normal")}>
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
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-muted-foreground text-xs sm:hidden">
                        {official.party ? (
                            <PartyChip colors={partyColors} party={official.party} />
                        ) : null}
                        {since ? (
                            <span className="tabular-nums">{tCard("since", { year: since })}</span>
                        ) : null}
                    </div>
                ) : null}
            </TableCell>
            <TableCell className={cn(CELL, "max-sm:hidden")}>
                {official.party ? (
                    <PartyChip colors={partyColors} party={official.party} />
                ) : (
                    <NotRecorded />
                )}
            </TableCell>
            <TableCell className={cn(CELL, "tabular-nums max-sm:hidden")}>
                {since ?? <NotRecorded />}
            </TableCell>
            <TableCell
                className={cn(
                    CELL,
                    "text-right max-sm:col-start-2 max-sm:row-span-2 max-sm:row-start-1"
                )}
            >
                <TripsCell summary={summary} />
            </TableCell>
        </TableRow>
    );
}

interface CabinetTableProps {
    entries: readonly LeaderEntry[];
    partyColors: PartyColors;
}

/**
 * The cabinet as a table to scan by portfolio and party. On phones each row stacks into the
 * portfolio, the minister with their party and start year, and their trips.
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
        <div className="flex flex-col gap-2">
            <div className="overflow-hidden rounded-xl border bg-card">
                <Table>
                    <TableHeader className="bg-muted/50 max-sm:sr-only">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className={headClass} scope="col">
                                {tColumns("portfolio")}
                            </TableHead>
                            <TableHead className={headClass} scope="col">
                                {tColumns("minister")}
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

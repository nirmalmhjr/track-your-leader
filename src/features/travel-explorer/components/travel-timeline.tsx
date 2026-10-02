"use client";

import { useTranslations } from "next-intl";
import { Fragment, useCallback } from "react";

import { CountryFlag } from "@/components/shared/country-flag";
import { TravelStatusBadge } from "@/features/travel-explorer/components/travel-status";
import { ROUTE_STYLES } from "@/features/travel-explorer/constants/map-style.constants";
import { useExplorerData } from "@/features/travel-explorer/hooks/use-explorer-data";
import { useExplorerFormat } from "@/features/travel-explorer/hooks/use-explorer-format";
import type { TravelRecord } from "@/features/travel-explorer/types/travel.types";
import { groupByYear } from "@/features/travel-explorer/utils/travel-aggregates.utils";
import { getCountryReference } from "@/lib/geo/country-reference";
import { cn } from "@/lib/utils";
import { useExplorerUiStore } from "@/stores/explorer-ui-store";

interface TravelTimelineProps {
    onSelect: (record: TravelRecord) => void;
    /**
     * `outbound` lists where officials went; `inbound` lists who visited, so the visiting
     * official and their country lead each entry.
     */
    perspective?: "outbound" | "inbound";
    /** Trips in display order, newest first. */
    records: readonly TravelRecord[];
    /** Show the travelling official on each entry (country-wide logs). */
    showOfficial?: boolean;
}

function TimelineDot({ record }: { record: TravelRecord }) {
    const style = ROUTE_STYLES[record.status];
    const isCompleted = record.status === "completed";

    return (
        <span
            aria-hidden
            className={cn(
                "relative z-10 mt-1.5 block size-2.5 rounded-full border-2 bg-sidebar",
                record.status === "planned" && "border-dotted"
            )}
            style={{
                backgroundColor: isCompleted ? style.color : undefined,
                borderColor: style.color,
            }}
        />
    );
}

function TimelineEntry({
    record,
    onSelect,
    perspective,
    showOfficial,
}: Required<Omit<TravelTimelineProps, "records">> & { record: TravelRecord }) {
    const t = useTranslations("Explorer");
    const format = useExplorerFormat();
    const { officialById, today } = useExplorerData();
    const setHoveredRecordId = useExplorerUiStore((state) => state.setHoveredRecordId);

    const handleSelect = useCallback(() => onSelect(record), [onSelect, record]);
    const handleHighlight = useCallback(
        () => setHoveredRecordId(record.id),
        [setHoveredRecordId, record.id]
    );
    const handleClearHighlight = useCallback(() => setHoveredRecordId(null), [setHoveredRecordId]);

    const official = officialById.get(record.officialId);
    const isInbound = perspective === "inbound";
    const leadCountry = isInbound ? record.originCountryCode : record.destination.countryCode;
    const isMultiDay = record.startDate !== record.endDate;
    const typeLabel = t(`travelTypes.${record.type}`);

    const title = isInbound
        ? (official?.fullName ?? record.positionTitle)
        : `${record.destination.city}, ${format.countryName(record.destination.countryCode)}`;
    const subtitle = isInbound
        ? `${record.positionTitle}, ${format.countryName(record.originCountryCode)} → ${record.destination.city}`
        : [typeLabel, record.eventName].filter(Boolean).join(" · ");

    return (
        <li className="relative grid grid-cols-[3.5rem_1.25rem_minmax(0,1fr)]">
            <span
                aria-hidden
                className="absolute inset-y-0 left-[calc(3.5rem+0.625rem-0.5px)] w-px bg-border"
            />
            <button
                className={cn(
                    "col-span-3 grid grid-cols-subgrid rounded-md py-2 pr-2 text-left outline-none transition-colors hover:bg-accent/50 focus-visible:ring-3 focus-visible:ring-ring/50",
                    record.status === "cancelled" && "opacity-70"
                )}
                onBlur={handleClearHighlight}
                onClick={handleSelect}
                onFocus={handleHighlight}
                onPointerEnter={handleHighlight}
                onPointerLeave={handleClearHighlight}
                type="button"
            >
                <span className="pt-0.5 pr-1 text-right text-muted-foreground text-xs tabular-nums">
                    <time dateTime={record.startDate}>{format.dayMonth(record.startDate)}</time>
                    {isMultiDay ? (
                        <time className="block text-[11px]" dateTime={record.endDate}>
                            – {format.dayMonth(record.endDate)}
                        </time>
                    ) : null}
                </span>
                <span className="flex justify-center">
                    <TimelineDot record={record} />
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex min-w-0 items-center gap-1.5 font-medium text-sm">
                        <CountryFlag alpha2={getCountryReference(leadCountry)?.alpha2} size="sm" />
                        <span
                            className={cn(
                                "truncate",
                                record.status === "cancelled" && "line-through decoration-1"
                            )}
                        >
                            {title}
                        </span>
                    </span>
                    <span className="truncate text-muted-foreground text-xs">{subtitle}</span>
                    {showOfficial && !isInbound && official ? (
                        <span className="truncate text-xs">
                            {official.fullName}
                            <span className="text-muted-foreground"> · {record.positionTitle}</span>
                        </span>
                    ) : null}
                    {isInbound ? (
                        <span className="truncate text-muted-foreground text-xs">{typeLabel}</span>
                    ) : null}
                    {record.status === "completed" ? null : (
                        <TravelStatusBadge className="mt-1" record={record} today={today} />
                    )}
                </span>
            </button>
        </li>
    );
}

/**
 * Chronological travel log grouped by year, newest first, with a "today" marker separating
 * scheduled trips from completed ones.
 */
export function TravelTimeline({
    records,
    onSelect,
    perspective = "outbound",
    showOfficial = false,
}: TravelTimelineProps) {
    const t = useTranslations("Explorer.timeline");
    const format = useExplorerFormat();
    const { today } = useExplorerData();

    const firstPastIndex = records.findIndex((record) => record.startDate <= today);
    const dividerRecordId = firstPastIndex > 0 ? (records[firstPastIndex]?.id ?? null) : null;

    return (
        <ol aria-label={t("label")} className="flex flex-col gap-2">
            {groupByYear(records).map((group) => (
                <li key={group.year}>
                    <h3 className="sticky top-0 z-20 bg-sidebar py-1.5 font-semibold text-muted-foreground text-xs tabular-nums">
                        {format.year(group.year)}
                    </h3>
                    <ol className="flex flex-col">
                        {group.records.map((record) => (
                            <Fragment key={record.id}>
                                {record.id === dividerRecordId ? (
                                    <li
                                        aria-label={t("today", { date: format.date(today) })}
                                        className="flex items-center gap-2 py-2 pl-1"
                                    >
                                        <span className="font-medium text-[11px] uppercase tracking-wide">
                                            {t("today", { date: format.date(today) })}
                                        </span>
                                        <span
                                            aria-hidden
                                            className="h-px flex-1 bg-foreground/25"
                                        />
                                    </li>
                                ) : null}
                                <TimelineEntry
                                    onSelect={onSelect}
                                    perspective={perspective}
                                    record={record}
                                    showOfficial={showOfficial}
                                />
                            </Fragment>
                        ))}
                    </ol>
                </li>
            ))}
        </ol>
    );
}

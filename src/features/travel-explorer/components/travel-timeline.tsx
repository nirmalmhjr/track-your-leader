"use client";

import { IconChevronDown } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { Fragment, useCallback } from "react";

import { CountryFlag } from "@/components/shared/country-flag";
import { TravelStatusBadge } from "@/components/shared/travel-status";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useExplorerData } from "@/features/travel-explorer/hooks/use-explorer-data";
import { useHoverHighlight } from "@/features/travel-explorer/hooks/use-hover-highlight";
import { useTravelFormat } from "@/hooks/use-travel-format";
import { getCountryReference } from "@/lib/geo/country-reference";
import { ROUTE_STYLES } from "@/lib/travel/travel.constants";
import { groupByYear } from "@/lib/travel/travel-summary.utils";
import { cn } from "@/lib/utils";
import { useExplorerUiStore } from "@/stores/explorer-ui-store";
import type { TravelRecord } from "@/types/travel.types";

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
    const format = useTravelFormat();
    const { officialById, today } = useExplorerData();
    const setHoveredRecordId = useExplorerUiStore((state) => state.setHoveredRecordId);

    const handleSelect = useCallback(() => onSelect(record), [onSelect, record]);
    const highlightHandlers = useHoverHighlight(setHoveredRecordId, record.id);

    const official = officialById.get(record.officialId);
    const isInbound = perspective === "inbound";
    const leadCountry = isInbound ? record.originCountryCode : record.destination.countryCode;
    const isMultiDay = record.datePrecision === "day" && record.startDate !== record.endDate;
    const typeLabel = t(`travelTypes.${record.type}`);

    const title = isInbound
        ? (official?.fullName ?? record.positionTitle)
        : format.placeWithCountry(record.destination);
    const subtitle = isInbound
        ? `${record.positionTitle}, ${format.countryName(record.originCountryCode)} → ${format.placeName(record.destination)}`
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
                onClick={handleSelect}
                type="button"
                {...highlightHandlers}
            >
                <span className="pt-0.5 pr-1 text-right text-muted-foreground text-xs tabular-nums">
                    <time dateTime={record.startDate}>{format.tripStartShort(record)}</time>
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

type EntryOptions = Required<Omit<TravelTimelineProps, "records">>;

/** One year's trips, with the "today" marker before the first trip that has started. */
function YearEntries({
    records,
    dividerRecordId,
    ...entryOptions
}: EntryOptions & { dividerRecordId: string | null; records: readonly TravelRecord[] }) {
    const t = useTranslations("Explorer.timeline");
    const format = useTravelFormat();
    const { today } = useExplorerData();

    return (
        <ol className="flex flex-col">
            {records.map((record) => (
                <Fragment key={record.id}>
                    {record.id === dividerRecordId ? (
                        <li
                            aria-label={t("today", { date: format.date(today) })}
                            className="flex items-center gap-2 py-2 pl-1"
                        >
                            <span className="font-medium text-[11px] uppercase tracking-wide">
                                {t("today", { date: format.date(today) })}
                            </span>
                            <span aria-hidden className="h-px flex-1 bg-foreground/25" />
                        </li>
                    ) : null}
                    <TimelineEntry record={record} {...entryOptions} />
                </Fragment>
            ))}
        </ol>
    );
}

/** A past year folded to its heading and trip count; selecting the heading reveals its trips. */
function CollapsedYear({
    year,
    records,
    dividerRecordId,
    ...entryOptions
}: EntryOptions & {
    dividerRecordId: string | null;
    records: readonly TravelRecord[];
    year: string;
}) {
    const t = useTranslations("Explorer.timeline");
    const format = useTravelFormat();

    return (
        <Collapsible>
            <h3 className="sticky top-0 z-20 bg-sidebar">
                <CollapsibleTrigger className="group flex w-full items-center gap-1.5 rounded-md py-1.5 text-left text-muted-foreground text-xs outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
                    <span className="font-semibold tabular-nums">{format.year(year)}</span>
                    <span aria-hidden>·</span>
                    <span>
                        {t("tripCount", {
                            count: records.length,
                            countLabel: format.number(records.length),
                        })}
                    </span>
                    <IconChevronDown
                        aria-hidden
                        className="ml-auto size-3.5 transition-transform group-data-panel-open:rotate-180"
                    />
                </CollapsibleTrigger>
            </h3>
            <CollapsibleContent>
                <YearEntries
                    dividerRecordId={dividerRecordId}
                    records={records}
                    {...entryOptions}
                />
            </CollapsibleContent>
        </Collapsible>
    );
}

/**
 * Chronological travel log grouped by year, newest first. The current year and any upcoming
 * years are listed in full, with a "today" marker separating scheduled trips from completed
 * ones; earlier years are folded so long histories stay scannable.
 */
export function TravelTimeline({
    records,
    onSelect,
    perspective = "outbound",
    showOfficial = false,
}: TravelTimelineProps) {
    const t = useTranslations("Explorer.timeline");
    const format = useTravelFormat();
    const { today } = useExplorerData();
    const entryOptions = { onSelect, perspective, showOfficial };
    const currentYear = today.slice(0, 4);

    const firstPastIndex = records.findIndex((record) => record.startDate <= today);
    const dividerRecordId = firstPastIndex > 0 ? (records[firstPastIndex]?.id ?? null) : null;

    return (
        <ol aria-label={t("label")} className="flex flex-col gap-2">
            {groupByYear(records).map((group) =>
                group.year < currentYear ? (
                    <li key={group.year}>
                        <CollapsedYear
                            dividerRecordId={dividerRecordId}
                            records={group.records}
                            year={group.year}
                            {...entryOptions}
                        />
                    </li>
                ) : (
                    <li key={group.year}>
                        <h3 className="sticky top-0 z-20 bg-sidebar py-1.5 font-semibold text-muted-foreground text-xs tabular-nums">
                            {format.year(group.year)}
                        </h3>
                        <YearEntries
                            dividerRecordId={dividerRecordId}
                            records={group.records}
                            {...entryOptions}
                        />
                    </li>
                )
            )}
        </ol>
    );
}

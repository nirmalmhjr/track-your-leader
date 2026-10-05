"use client";

import { IconExternalLink } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";

import { CountryFlag } from "@/components/shared/country-flag";
import { ShowMoreButton } from "@/components/shared/show-more-button";
import { TravelStatusBadge } from "@/components/shared/travel-status";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SectionHeading } from "@/features/leaders/components/section-heading";
import { useTravelFormat } from "@/hooks/use-travel-format";
import { getCountryReference } from "@/lib/geo/country-reference";
import { ROUTE_STYLES } from "@/lib/travel/travel.constants";
import { groupByYear } from "@/lib/travel/travel-summary.utils";
import { cn } from "@/lib/utils";
import type { IsoDate, TravelRecord, TravelStatus } from "@/types/travel.types";

const STATUS_ORDER: readonly TravelStatus[] = ["completed", "upcoming", "planned", "cancelled"];
const ALL = "all";
const STATUS_FILTERS = [ALL, ...STATUS_ORDER] as const;
/** Trips rendered per page. */
const TRIP_PAGE_SIZE = 25;

function TripDot({ status }: { status: TravelStatus }) {
    const style = ROUTE_STYLES[status];

    return (
        <span
            aria-hidden
            className={cn(
                "absolute top-1.5 -left-[5.5px] block size-2.5 rounded-full border-2 bg-card",
                status === "planned" && "border-dotted"
            )}
            style={{
                backgroundColor: status === "completed" ? style.color : undefined,
                borderColor: style.color,
            }}
        />
    );
}

interface TripEntryProps {
    /** Title the official holds now, so earlier titles can be called out. */
    currentTitle: string;
    record: TravelRecord;
    today: IsoDate;
}

function TripEntry({ record, today, currentTitle }: TripEntryProps) {
    const t = useTranslations("Leaders.profile");
    const tTypes = useTranslations("Explorer.travelTypes");
    const format = useTravelFormat();
    const reference = getCountryReference(record.destination.countryCode);
    const details = [tTypes(record.type), record.eventName].filter(Boolean).join(" · ");
    const showsEarlierTitle = record.positionTitle && record.positionTitle !== currentTitle;

    return (
        <li className="grid grid-cols-[4.5rem_1fr] gap-x-4 sm:grid-cols-[7rem_1fr]">
            <span className="pt-0.5 text-right text-muted-foreground text-xs tabular-nums leading-snug">
                {format.tripDates(record)}
            </span>
            <div className="relative flex min-w-0 flex-col gap-1.5 border-l pb-6 pl-5">
                <TripDot status={record.status} />
                <p className="flex min-w-0 items-center gap-2 font-medium leading-snug">
                    <CountryFlag alpha2={reference?.alpha2} size="sm" />
                    <span className="truncate">{format.placeWithCountry(record.destination)}</span>
                </p>
                {details ? <p className="text-muted-foreground text-xs">{details}</p> : null}
                {record.purpose ? <p className="text-pretty text-sm">{record.purpose}</p> : null}
                {record.engagements.length > 0 ? (
                    <div className="flex flex-col gap-1">
                        <p className="text-muted-foreground text-xs">{t("engagements")}</p>
                        <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground text-sm marker:text-border">
                            {record.engagements.map((engagement) => (
                                <li key={engagement}>{engagement}</li>
                            ))}
                        </ul>
                    </div>
                ) : null}
                {record.status !== "completed" || showsEarlierTitle || record.sources.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                        {record.status === "completed" ? null : (
                            <TravelStatusBadge record={record} today={today} />
                        )}
                        {showsEarlierTitle ? (
                            <span className="text-muted-foreground">
                                {t("asTitle", { title: record.positionTitle })}
                            </span>
                        ) : null}
                        {record.sources.map((source) => (
                            <a
                                className="inline-flex items-center gap-1 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                                href={source.url}
                                key={source.url}
                                rel="noopener noreferrer"
                                target="_blank"
                            >
                                {source.label}
                                <IconExternalLink aria-hidden className="size-3" />
                            </a>
                        ))}
                    </div>
                ) : null}
            </div>
        </li>
    );
}

interface TripLogProps {
    currentTitle: string;
    /** The official's trips, newest first. */
    records: readonly TravelRecord[];
    today: IsoDate;
}

/** Every recorded trip, newest first, grouped by year and filterable by status and year. */
export function TripLog({ records, today, currentTitle }: TripLogProps) {
    const t = useTranslations("Leaders.profile");
    const tStatus = useTranslations("Explorer.statuses");
    const format = useTravelFormat();
    const [status, setStatus] = useState<TravelStatus | typeof ALL>(ALL);
    const [year, setYear] = useState<string>(ALL);
    const [shown, setShown] = useState(TRIP_PAGE_SIZE);

    const statusCounts = useMemo(() => {
        const counts = new Map<TravelStatus, number>();
        for (const record of records) {
            counts.set(record.status, (counts.get(record.status) ?? 0) + 1);
        }
        return counts;
    }, [records]);
    const years = useMemo(
        () => [...new Set(records.map((record) => record.startDate.slice(0, 4)))],
        [records]
    );
    const filtered = useMemo(
        () =>
            records.filter(
                (record) =>
                    (status === ALL || record.status === status) &&
                    (year === ALL || record.startDate.startsWith(year))
            ),
        [records, status, year]
    );
    const groups = useMemo(() => groupByYear(filtered.slice(0, shown)), [filtered, shown]);

    const handleStatusChange = useCallback((values: string[]) => {
        const next = STATUS_FILTERS.find((candidate) => candidate === values[0]);
        if (next) {
            setStatus(next);
            setShown(TRIP_PAGE_SIZE);
        }
    }, []);
    const handleYearChange = useCallback((value: string | null) => {
        setYear(value ?? ALL);
        setShown(TRIP_PAGE_SIZE);
    }, []);
    const showMore = useCallback(() => setShown((count) => count + TRIP_PAGE_SIZE), []);

    const yearItems = [
        { label: t("allYears"), value: ALL },
        ...years.map((value) => ({ label: format.year(value), value })),
    ];
    const remaining = filtered.length - shown;

    return (
        <section aria-labelledby="trip-log" className="flex flex-col gap-4">
            <SectionHeading
                caption={t("tripLogCaption", {
                    count: records.length,
                    countLabel: format.number(records.length),
                })}
                id="trip-log"
                title={t("tripLog")}
            />
            <div className="flex flex-wrap items-center gap-2">
                <ToggleGroup
                    aria-label={t("statusFilter")}
                    className="flex-wrap"
                    onValueChange={handleStatusChange}
                    size="sm"
                    spacing={0}
                    value={[status]}
                    variant="outline"
                >
                    <ToggleGroupItem
                        className="px-3 text-muted-foreground data-pressed:bg-muted data-pressed:text-foreground"
                        value={ALL}
                    >
                        {t("allStatuses")}
                    </ToggleGroupItem>
                    {STATUS_ORDER.filter((value) => statusCounts.has(value)).map((value) => (
                        <ToggleGroupItem
                            className="gap-1.5 px-3 text-muted-foreground data-pressed:bg-muted data-pressed:text-foreground"
                            key={value}
                            value={value}
                        >
                            {tStatus(value)}
                            <span className="tabular-nums">
                                {format.number(statusCounts.get(value) ?? 0)}
                            </span>
                        </ToggleGroupItem>
                    ))}
                </ToggleGroup>
                {years.length > 1 ? (
                    <Select items={yearItems} onValueChange={handleYearChange} value={year}>
                        <SelectTrigger aria-label={t("yearFilter")} size="sm">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                {yearItems.map((item) => (
                                    <SelectItem key={item.value} value={item.value}>
                                        {item.label}
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                ) : null}
            </div>

            {filtered.length === 0 ? (
                <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground text-sm">
                    {t("noFilteredTrips")}
                </p>
            ) : (
                <div className="flex flex-col gap-2">
                    {groups.map((group) => (
                        <section aria-label={format.year(group.year)} key={group.year}>
                            <h3 className="mb-3 font-semibold text-muted-foreground text-sm tabular-nums">
                                {format.year(group.year)}
                            </h3>
                            <ol>
                                {group.records.map((record) => (
                                    <TripEntry
                                        currentTitle={currentTitle}
                                        key={record.id}
                                        record={record}
                                        today={today}
                                    />
                                ))}
                            </ol>
                        </section>
                    ))}
                    {remaining > 0 ? (
                        <ShowMoreButton
                            label={t("showMoreTrips", {
                                count: remaining,
                                countLabel: format.number(remaining),
                            })}
                            onShowMore={showMore}
                            shownCount={shown}
                        />
                    ) : null}
                </div>
            )}
        </section>
    );
}

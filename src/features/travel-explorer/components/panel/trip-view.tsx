"use client";

import {
    IconAlertTriangle,
    IconChevronLeft,
    IconChevronRight,
    IconPlane,
} from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useCallback } from "react";

import { CountryFlag } from "@/components/shared/country-flag";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { OfficialAvatar } from "@/features/travel-explorer/components/official-avatar";
import { ClearFiltersEmpty } from "@/features/travel-explorer/components/panel/clear-filters-empty";
import { TravelStatusBadge } from "@/features/travel-explorer/components/travel-status";
import { useExplorerData } from "@/features/travel-explorer/hooks/use-explorer-data";
import { useExplorerFormat } from "@/features/travel-explorer/hooks/use-explorer-format";
import { useExplorerState } from "@/features/travel-explorer/hooks/use-explorer-state";
import type { Place } from "@/features/travel-explorer/types/travel.types";
import { countDaysInclusive } from "@/features/travel-explorer/utils/date.utils";
import { getCountryReference } from "@/lib/geo/country-reference";

function RouteEnd({ place, label }: { place: Place; label: string }) {
    const format = useExplorerFormat();

    return (
        <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-[11px] text-muted-foreground uppercase tracking-wide">
                {label}
            </span>
            <span className="flex min-w-0 items-center gap-2">
                <CountryFlag alpha2={getCountryReference(place.countryCode)?.alpha2} />
                <span className="truncate font-medium text-sm">{place.city}</span>
            </span>
            <span className="truncate text-muted-foreground text-xs">
                {format.countryName(place.countryCode)}
            </span>
        </div>
    );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 py-2">
            <dt className="text-muted-foreground text-xs">{label}</dt>
            <dd className="text-sm">{children}</dd>
        </div>
    );
}

/** Full details of a single trip, with stepping to the official's previous and next trips. */
export function TripView({ recordId }: { recordId: string }) {
    const t = useTranslations("Explorer");
    const format = useExplorerFormat();
    const { officialById, recordById, recordsByOfficial, matchingRecords, today } =
        useExplorerData();
    const { selectOfficial, selectTrip } = useExplorerState();

    const record = recordById.get(recordId);
    const siblings = record ? (recordsByOfficial.get(record.officialId) ?? []) : [];
    const index = record ? siblings.findIndex((candidate) => candidate.id === record.id) : -1;
    // Siblings are newest first, so the chronologically next trip sits at the lower index.
    const newer = index > 0 ? siblings[index - 1] : undefined;
    const older = index >= 0 ? siblings[index + 1] : undefined;
    const official = record ? officialById.get(record.officialId) : undefined;

    const handleOpenOfficial = useCallback(() => {
        if (official) {
            selectOfficial(official);
        }
    }, [official, selectOfficial]);
    const handleOlder = useCallback(() => {
        if (older) {
            selectTrip(older);
        }
    }, [older, selectTrip]);
    const handleNewer = useCallback(() => {
        if (newer) {
            selectTrip(newer);
        }
    }, [newer, selectTrip]);

    if (!record) {
        return (
            <div className="p-4">
                <ClearFiltersEmpty
                    description={t("trip.notFoundDescription")}
                    title={t("trip.notFoundTitle")}
                />
            </div>
        );
    }

    const isOutsideFilters = !matchingRecords.some((candidate) => candidate.id === record.id);
    const days = countDaysInclusive(record.startDate, record.endDate);

    return (
        <div className="flex flex-col gap-5 p-4">
            {isOutsideFilters ? (
                <p className="flex gap-2 rounded-lg border bg-muted/40 p-3 text-muted-foreground text-xs">
                    <IconAlertTriangle aria-hidden className="size-4 shrink-0" />
                    {t("trip.outsideFilters")}
                </p>
            ) : null}

            <header className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                    <TravelStatusBadge record={record} today={today} />
                    <span className="text-muted-foreground text-xs">
                        {t(`travelTypes.${record.type}`)}
                    </span>
                </div>
                <h2 className="font-semibold text-lg leading-snug">
                    {record.eventName ?? record.purpose}
                </h2>
                <p className="text-muted-foreground text-sm tabular-nums">
                    {format.dateRange(record.startDate, record.endDate)} ·{" "}
                    {t("trip.days", { count: days, countLabel: format.number(days) })}
                </p>
            </header>

            <div className="flex items-center gap-3 rounded-lg border p-3">
                <RouteEnd label={t("trip.origin")} place={record.origin} />
                <IconPlane
                    aria-hidden
                    className="size-4 shrink-0 rotate-45 text-muted-foreground"
                />
                <RouteEnd label={t("trip.destination")} place={record.destination} />
            </div>

            <dl className="flex flex-col divide-y">
                <DetailRow label={t("trip.purpose")}>{record.purpose}</DetailRow>
                {record.eventName ? (
                    <DetailRow label={t("trip.event")}>{record.eventName}</DetailRow>
                ) : null}
                <DetailRow label={t("trip.region")}>
                    {t(`regions.${record.destination.region}`)}
                </DetailRow>
                <DetailRow label={t("trip.traveller")}>
                    {official ? (
                        <button
                            className="flex items-center gap-2 rounded-md text-left outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                            onClick={handleOpenOfficial}
                            type="button"
                        >
                            <OfficialAvatar official={official} size="sm" />
                            <span className="flex min-w-0 flex-col">
                                <span className="truncate">{official.fullName}</span>
                                <span className="truncate text-muted-foreground text-xs">
                                    {record.positionTitle}
                                </span>
                            </span>
                        </button>
                    ) : (
                        record.positionTitle
                    )}
                </DetailRow>
            </dl>

            {record.engagements.length > 0 ? (
                <section aria-labelledby="trip-engagements" className="flex flex-col gap-2">
                    <h3 className="font-medium text-sm" id="trip-engagements">
                        {t("trip.engagements")}
                    </h3>
                    <ul className="flex flex-col gap-1.5 text-sm">
                        {record.engagements.map((engagement) => (
                            <li className="flex gap-2" key={engagement}>
                                <span
                                    aria-hidden
                                    className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground"
                                />
                                {engagement}
                            </li>
                        ))}
                    </ul>
                </section>
            ) : null}

            <Separator />

            <nav
                aria-label={t("trip.stepLabel")}
                className="flex items-center justify-between gap-2"
            >
                <Button disabled={!older} onClick={handleOlder} size="sm" variant="outline">
                    <IconChevronLeft data-icon="inline-start" />
                    {t("trip.previous")}
                </Button>
                <span className="text-muted-foreground text-xs tabular-nums">
                    {index >= 0
                        ? t("trip.position", {
                              current: format.number(siblings.length - index),
                              total: format.number(siblings.length),
                          })
                        : null}
                </span>
                <Button disabled={!newer} onClick={handleNewer} size="sm" variant="outline">
                    {t("trip.next")}
                    <IconChevronRight data-icon="inline-end" />
                </Button>
            </nav>
        </div>
    );
}

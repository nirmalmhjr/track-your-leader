"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";

import { CountryFlag } from "@/components/shared/country-flag";
import { OfficialAvatar } from "@/components/shared/official-avatar";
import { useHoverHighlight } from "@/features/travel-explorer/hooks/use-hover-highlight";
import { useTravelFormat } from "@/hooks/use-travel-format";
import { getCountryReference } from "@/lib/geo/country-reference";
import { getCurrentPosition, getPrimaryPosition } from "@/lib/travel/officials.utils";
import { cn } from "@/lib/utils";
import { useExplorerUiStore } from "@/stores/explorer-ui-store";
import type { Official, TravelRecord, TravelSummary } from "@/types/travel.types";

interface OfficialCardProps {
    official: Official;
    onSelect: (official: Official) => void;
    summary: TravelSummary;
}

function TripLine({
    label,
    record,
    tone,
}: {
    label: string;
    record: TravelRecord;
    tone: "past" | "future";
}) {
    const format = useTravelFormat();

    return (
        <div className="flex min-w-0 items-baseline gap-2">
            <dt className="flex w-16 shrink-0 items-center gap-1.5 text-muted-foreground">
                <span
                    aria-hidden
                    className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        tone === "past"
                            ? "bg-travel-completed"
                            : "border border-travel-upcoming bg-transparent"
                    )}
                />
                {label}
            </dt>
            <dd className="min-w-0 truncate">
                <span className="text-foreground">
                    {tone === "past"
                        ? `${record.origin.city} → ${format.placeName(record.destination)}`
                        : format.placeName(record.destination)}
                </span>
                <span className="text-muted-foreground"> · {format.tripStart(record)}</span>
            </dd>
        </div>
    );
}

/** Result card for an official, summarising their travel within the active filters. */
export function OfficialCard({ official, summary, onSelect }: OfficialCardProps) {
    const t = useTranslations("Explorer");
    const format = useTravelFormat();
    const setHoveredOfficialId = useExplorerUiStore((state) => state.setHoveredOfficialId);

    const handleSelect = useCallback(() => onSelect(official), [onSelect, official]);
    const highlightHandlers = useHoverHighlight(setHoveredOfficialId, official.id);

    const position = getPrimaryPosition(official);
    const isFormer = getCurrentPosition(official) === null;
    const reference = getCountryReference(official.countryCode);
    const roleLabel = t(`roles.${position.categories[0]}`);

    return (
        <button
            className="group flex w-full gap-3 rounded-lg border bg-card p-3 text-left outline-none transition-colors hover:border-foreground/20 hover:bg-accent/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            onClick={handleSelect}
            type="button"
            {...highlightHandlers}
        >
            <OfficialAvatar official={official} />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                        <span className="block truncate font-medium text-sm">
                            {official.fullName}
                        </span>
                        <span className="block truncate text-muted-foreground text-xs">
                            {isFormer
                                ? t("official.formerTitle", { title: position.title })
                                : position.title}
                        </span>
                    </span>
                    <span className="shrink-0 text-right">
                        <span className="block font-semibold text-sm tabular-nums leading-tight">
                            {format.number(summary.tripCount)}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">
                            {t("official.tripUnit", { count: summary.tripCount })}
                        </span>
                    </span>
                </span>

                <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground text-xs">
                    <CountryFlag alpha2={reference?.alpha2} size="sm" />
                    <span className="truncate">
                        {[format.countryName(official.countryCode), roleLabel, official.party]
                            .filter(Boolean)
                            .join(" · ")}
                    </span>
                </span>

                <span className="line-clamp-2 text-muted-foreground text-xs">
                    {official.summary}
                </span>

                <dl className="mt-1 flex flex-col gap-1 border-t pt-2 text-xs">
                    {summary.lastTrip ? (
                        <TripLine
                            label={t("official.recent")}
                            record={summary.lastTrip}
                            tone="past"
                        />
                    ) : (
                        <div className="text-muted-foreground">
                            <dt className="sr-only">{t("official.recent")}</dt>
                            <dd>{t("official.noRecentTrips")}</dd>
                        </div>
                    )}
                    {summary.nextTrip ? (
                        <TripLine
                            label={t("official.upcoming")}
                            record={summary.nextTrip}
                            tone="future"
                        />
                    ) : null}
                </dl>
            </span>
        </button>
    );
}

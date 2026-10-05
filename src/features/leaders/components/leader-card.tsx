"use client";

import { useTranslations } from "next-intl";

import { CountryFlag } from "@/components/shared/country-flag";
import { useDirectoryFormat } from "@/features/leaders/hooks/use-directory-format";
import type { LeaderEntry } from "@/features/leaders/types/leaders.types";
import { getProfilePath } from "@/features/leaders/utils/leaders-paths";
import { OfficialAvatar } from "@/features/travel-explorer/components/official-avatar";
import type { TravelRecord } from "@/features/travel-explorer/types/travel.types";
import { getPrimaryPosition } from "@/features/travel-explorer/utils/filters.utils";
import { Link } from "@/i18n/navigation";
import { getCountryReference } from "@/lib/geo/country-reference";
import { cn } from "@/lib/utils";

interface LeaderCardProps {
    entry: LeaderEntry;
    /** Headline figure; defaults to the official's trip count. */
    figure?: { label: string; value: number };
    /** Show the official's country; redundant on a country's own page. */
    showCountry?: boolean;
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
    const format = useDirectoryFormat();

    return (
        <div className="flex min-w-0 items-baseline gap-2">
            <dt className="flex w-12 shrink-0 items-center gap-1.5 text-muted-foreground">
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
                    {format.placeWithCountry(record.destination)}
                </span>
                <span className="text-muted-foreground"> · {format.tripStart(record)}</span>
            </dd>
        </div>
    );
}

/** A leader as a card linking to their profile, with their travel at a glance. */
export function LeaderCard({ entry, figure, showCountry = false }: LeaderCardProps) {
    const t = useTranslations("Leaders.card");
    const format = useDirectoryFormat();
    const { official, summary } = entry;
    const position = getPrimaryPosition(official);
    const reference = getCountryReference(official.countryCode);

    return (
        <Link
            className="group flex h-full flex-col gap-4 rounded-xl border bg-card p-4 outline-none transition-colors hover:border-foreground/20 hover:bg-accent/30 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            href={getProfilePath(official.countryCode, official.id)}
        >
            <div className="flex items-start gap-3">
                <OfficialAvatar official={official} size="xl" />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate font-semibold leading-snug group-hover:underline group-hover:underline-offset-2">
                        {official.fullName}
                    </span>
                    <span className="line-clamp-2 text-muted-foreground text-sm leading-snug">
                        {position.title}
                    </span>
                    {showCountry || official.party ? (
                        <span className="mt-1 flex min-w-0 items-center gap-1.5 text-muted-foreground text-xs">
                            {showCountry ? (
                                <CountryFlag alpha2={reference?.alpha2} size="sm" />
                            ) : null}
                            <span className="truncate">
                                {[
                                    showCountry ? format.countryName(official.countryCode) : null,
                                    official.party,
                                ]
                                    .filter(Boolean)
                                    .join(" · ")}
                            </span>
                        </span>
                    ) : null}
                </div>
                <div className="w-20 shrink-0 text-right">
                    <span className="block font-semibold text-2xl leading-none">
                        {format.number(figure?.value ?? summary.tripCount)}
                    </span>
                    <span className="mt-1 block text-[11px] text-muted-foreground leading-tight">
                        {figure?.label ?? t("trips", { count: summary.tripCount })}
                    </span>
                </div>
            </div>

            <dl className="mt-auto flex flex-col gap-1 border-t pt-3 text-xs">
                {summary.lastTrip ? (
                    <TripLine label={t("last")} record={summary.lastTrip} tone="past" />
                ) : null}
                {summary.nextTrip ? (
                    <TripLine label={t("next")} record={summary.nextTrip} tone="future" />
                ) : null}
                {summary.lastTrip || summary.nextTrip ? null : (
                    <div className="text-muted-foreground">
                        <dt className="sr-only">{t("last")}</dt>
                        <dd>{t("noTrips")}</dd>
                    </div>
                )}
            </dl>
        </Link>
    );
}

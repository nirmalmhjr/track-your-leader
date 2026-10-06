"use client";

import { useTranslations } from "next-intl";

import { CountryFlag } from "@/components/shared/country-flag";
import { OfficialAvatar } from "@/components/shared/official-avatar";
import { ROUTES } from "@/configs/routes";
import { PartyChip } from "@/features/leaders/components/party-chip";
import type { LeaderEntry, PartyColors } from "@/features/leaders/types/leaders.types";
import { useTravelFormat } from "@/hooks/use-travel-format";
import { Link } from "@/i18n/navigation";
import { getCountryReference } from "@/lib/geo/country-reference";
import { getTermYears } from "@/lib/travel/offices.utils";
import {
    getOtherCurrentPositions,
    getPortfolioName,
    getPrimaryPosition,
    isCurrentPosition,
} from "@/lib/travel/officials.utils";
import { cn } from "@/lib/utils";
import type { Official, Position, TravelRecord } from "@/types/travel.types";

interface LeaderCardProps {
    entry: LeaderEntry;
    /** Headline figure; defaults to the official's trip count. */
    figure?: { label: string; value: number };
    /** Colours of the party chips; with them, the party shows as a chip, or as unrecorded. */
    partyColors?: PartyColors;
    /** Show the official's country; redundant on a country's own page. */
    showCountry?: boolean;
    /** Say "In office" or "Former" before the years; redundant under an "In office" heading. */
    showStatus?: boolean;
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

/**
 * "In office · since 2025" or "Former · 2017 – 2021", falling back to the bare status. Without
 * the status it is just "Since 2025", or nothing when the start isn't recorded.
 */
function TenureLine({ position, showStatus }: { position: Position; showStatus: boolean }) {
    const t = useTranslations("Leaders.card");
    const format = useTravelFormat();
    const isInOffice = isCurrentPosition(position);
    const { start, end } = getTermYears(position);
    const startYear = start ? format.year(start) : null;
    const endYear = end ? format.year(end) : null;

    let label: string | null;
    if (isInOffice && !showStatus) {
        label = startYear ? t("since", { year: startYear }) : null;
    } else if (isInOffice) {
        label = startYear ? t("inOfficeSince", { year: startYear }) : t("inOffice");
    } else {
        const years =
            startYear && endYear && startYear !== endYear
                ? `${startYear} – ${endYear}`
                : (endYear ?? startYear);
        label = years ? t("formerYears", { years }) : t("former");
    }
    if (!label) {
        return null;
    }

    return (
        <span className="flex min-w-0 items-center gap-1.5 text-xs">
            <span
                aria-hidden
                className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    isInOffice ? "bg-primary" : "bg-muted-foreground/50"
                )}
            />
            <span
                className={cn(
                    "truncate tabular-nums",
                    isInOffice ? "font-medium text-primary" : "text-muted-foreground"
                )}
            >
                {label}
            </span>
        </span>
    );
}

/** "Also Defence · Home Affairs": the other offices an official holds today, if any. */
function OtherOfficesLine({ official }: { official: Official }) {
    const t = useTranslations("Leaders.card");
    const others = getOtherCurrentPositions(official);
    if (others.length === 0) {
        return null;
    }

    return (
        <span className="line-clamp-2 text-muted-foreground text-xs leading-snug">
            {t("also")}{" "}
            <span className="font-medium text-foreground">
                {others.map((position) => getPortfolioName(position.title)).join(" · ")}
            </span>
        </span>
    );
}

/** A leader as a card linking to their profile, with their travel at a glance. */
export function LeaderCard({
    entry,
    figure,
    partyColors,
    showCountry = false,
    showStatus = true,
}: LeaderCardProps) {
    const t = useTranslations("Leaders.card");
    const format = useTravelFormat();
    const { official, summary } = entry;
    const position = getPrimaryPosition(official);
    const reference = getCountryReference(official.countryCode);

    return (
        <Link
            className="group flex h-full flex-col gap-4 rounded-xl border bg-card p-4 outline-none transition-colors hover:border-foreground/20 hover:bg-accent/30 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            href={ROUTES.leadersProfile(official.countryCode, official.id)}
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
                    <TenureLine position={position} showStatus={showStatus} />
                    <OtherOfficesLine official={official} />
                    {partyColors ? (
                        <PartyChip
                            className="mt-1 self-start"
                            colors={partyColors}
                            party={official.party}
                        />
                    ) : null}
                    {showCountry || (official.party && !partyColors) ? (
                        <span className="mt-1 flex min-w-0 items-center gap-1.5 text-muted-foreground text-xs">
                            {showCountry ? (
                                <CountryFlag alpha2={reference?.alpha2} size="sm" />
                            ) : null}
                            <span className="truncate">
                                {[
                                    showCountry ? format.countryName(official.countryCode) : null,
                                    partyColors ? null : official.party,
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

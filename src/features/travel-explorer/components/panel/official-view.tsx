"use client";

import { IconChevronDown } from "@tabler/icons-react";
import { useTranslations } from "next-intl";

import { CountryFlag } from "@/components/shared/country-flag";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { OfficialAvatar } from "@/features/travel-explorer/components/official-avatar";
import { ClearFiltersEmpty } from "@/features/travel-explorer/components/panel/clear-filters-empty";
import { StatList } from "@/features/travel-explorer/components/stat-list";
import { TravelTimeline } from "@/features/travel-explorer/components/travel-timeline";
import { useDateRangeLabel } from "@/features/travel-explorer/hooks/use-date-range-label";
import { useExplorerData } from "@/features/travel-explorer/hooks/use-explorer-data";
import { useExplorerFormat } from "@/features/travel-explorer/hooks/use-explorer-format";
import { useExplorerState } from "@/features/travel-explorer/hooks/use-explorer-state";
import type { Official, Position } from "@/features/travel-explorer/types/travel.types";
import {
    getCurrentPosition,
    getPrimaryPosition,
} from "@/features/travel-explorer/utils/filters.utils";
import { summarizeTravel } from "@/features/travel-explorer/utils/travel-aggregates.utils";
import { getCountryReference } from "@/lib/geo/country-reference";

/** Tenure line for a position; sources sometimes list an office holder without a start date. */
function PositionTenure({ position }: { position: Position }) {
    const t = useTranslations("Explorer.official");
    const format = useExplorerFormat();
    const { startDate, endDate } = position;

    let label: string | null = null;
    if (startDate && endDate) {
        label = format.dateRange(startDate, endDate);
    } else if (endDate) {
        label = t("until", { date: format.date(endDate) });
    } else if (startDate) {
        label = t("since", { date: format.date(startDate) });
    }

    return label ? (
        <span className="text-muted-foreground text-xs tabular-nums">{label}</span>
    ) : null;
}

/** Links to the public pages an official's profile was compiled from. */
function OfficialSources({ sources }: { sources: Official["sources"] }) {
    const t = useTranslations("Explorer.official");

    if (sources.length === 0) {
        return null;
    }

    return (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs">
            <span>{t("sources")}:</span>
            {sources.map((source) => (
                <a
                    className="underline-offset-2 hover:text-foreground hover:underline"
                    href={source.url}
                    key={source.url}
                    rel="noopener noreferrer"
                    target="_blank"
                >
                    {source.label}
                </a>
            ))}
        </p>
    );
}

function PositionHistory({ official }: { official: Official }) {
    const t = useTranslations("Explorer.official");

    return (
        <Collapsible defaultOpen={official.positions.length > 1}>
            <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-md py-1 font-medium text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                {t("positions", { count: official.positions.length })}
                <IconChevronDown
                    aria-hidden
                    className="size-4 text-muted-foreground transition-transform group-data-panel-open:rotate-180"
                />
            </CollapsibleTrigger>
            <CollapsibleContent>
                <ol className="mt-2 flex flex-col gap-3 border-l pl-4">
                    {official.positions.map((position) => (
                        <li className="flex flex-col gap-0.5" key={position.id}>
                            <span className="flex flex-wrap items-center gap-2 text-sm">
                                {position.title}
                                {position.endDate === null ? (
                                    <Badge variant="secondary">{t("current")}</Badge>
                                ) : null}
                            </span>
                            {position.ministry ? (
                                <span className="text-muted-foreground text-xs">
                                    {position.ministry}
                                </span>
                            ) : null}
                            <PositionTenure position={position} />
                        </li>
                    ))}
                </ol>
            </CollapsibleContent>
        </Collapsible>
    );
}

/** Profile and chronological travel history of one official. */
export function OfficialView({ officialId }: { officialId: string }) {
    const t = useTranslations("Explorer");
    const format = useExplorerFormat();
    const describeRange = useDateRangeLabel();
    const { officialById, recordsByOfficial } = useExplorerData();
    const { filters, selectTrip } = useExplorerState();

    const official = officialById.get(officialId);
    if (!official) {
        return (
            <div className="p-4">
                <ClearFiltersEmpty
                    description={t("official.notFoundDescription")}
                    title={t("official.notFoundTitle")}
                />
            </div>
        );
    }

    const records = recordsByOfficial.get(official.id) ?? [];
    const summary = summarizeTravel(records);
    const position = getPrimaryPosition(official);
    const current = getCurrentPosition(official);
    const reference = getCountryReference(official.countryCode);

    return (
        <div className="flex flex-col gap-5 p-4">
            <header className="flex items-start gap-3">
                <OfficialAvatar official={official} size="xl" />
                <div className="flex min-w-0 flex-col gap-1">
                    <h2 className="font-semibold text-lg leading-tight">{official.fullName}</h2>
                    <p className="text-sm">
                        {current
                            ? position.title
                            : t("official.formerTitle", { title: position.title })}
                    </p>
                    <p className="flex min-w-0 items-center gap-1.5 text-muted-foreground text-xs">
                        <CountryFlag alpha2={reference?.alpha2} size="sm" />
                        <span className="truncate">
                            {[format.countryName(official.countryCode), official.party]
                                .filter(Boolean)
                                .join(" · ")}
                        </span>
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                        {position.categories.map((category) => (
                            <Badge key={category} variant="outline">
                                {t(`roles.${category}`)}
                            </Badge>
                        ))}
                        {current ? null : <Badge variant="secondary">{t("tenure.former")}</Badge>}
                    </div>
                </div>
            </header>

            {official.summary ? (
                <p className="text-muted-foreground text-sm">{official.summary}</p>
            ) : null}

            <StatList
                items={[
                    { label: t("stats.trips"), value: format.number(summary.tripCount) },
                    { label: t("stats.countries"), value: format.number(summary.countryCount) },
                    { label: t("stats.daysAbroad"), value: format.number(summary.daysAbroad) },
                    { label: t("stats.upcoming"), value: format.number(summary.upcomingCount) },
                ]}
            />

            <PositionHistory official={official} />
            <OfficialSources sources={official.sources} />

            <section aria-labelledby="official-travel-history" className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-medium text-sm" id="official-travel-history">
                        {t("official.travelHistory")}
                    </h3>
                    <span className="truncate text-muted-foreground text-xs">
                        {describeRange(filters.from, filters.to)}
                    </span>
                </div>
                {records.length === 0 ? (
                    <ClearFiltersEmpty
                        description={t("official.noTripsDescription")}
                        title={t("official.noTripsTitle")}
                    />
                ) : (
                    <TravelTimeline onSelect={selectTrip} records={records} />
                )}
            </section>
        </div>
    );
}

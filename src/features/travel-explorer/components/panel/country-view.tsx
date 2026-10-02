"use client";

import { IconInfoCircle } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { useCallback } from "react";

import { CountryFlag } from "@/components/shared/country-flag";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClearFiltersEmpty } from "@/features/travel-explorer/components/panel/clear-filters-empty";
import { OfficialsList } from "@/features/travel-explorer/components/panel/officials-list";
import { StatList } from "@/features/travel-explorer/components/stat-list";
import { TravelTimeline } from "@/features/travel-explorer/components/travel-timeline";
import { COUNTRY_VIEWS } from "@/features/travel-explorer/constants/explorer.constants";
import { useExplorerData } from "@/features/travel-explorer/hooks/use-explorer-data";
import { useExplorerFormat } from "@/features/travel-explorer/hooks/use-explorer-format";
import { useExplorerState } from "@/features/travel-explorer/hooks/use-explorer-state";
import { summarizeTravel } from "@/features/travel-explorer/utils/travel-aggregates.utils";
import { getCountryReference } from "@/lib/geo/country-reference";
import type { CountryCode } from "@/types/geo.types";

/** Country dossier: who travels, where they went and who came to visit. */
export function CountryView({ countryCode }: { countryCode: CountryCode }) {
    const t = useTranslations("Explorer");
    const format = useExplorerFormat();
    const {
        countryByCode,
        matchingOfficialIds,
        officialsByCountry,
        recordsByDestination,
        recordsByOrigin,
    } = useExplorerData();
    const { selection, selectTrip, setView } = useExplorerState();

    const handleViewChange = useCallback(
        (value: unknown) => {
            const next = COUNTRY_VIEWS.find((view) => view === value);
            if (next) {
                setView(next);
            }
        },
        [setView]
    );

    const tracked = countryByCode.get(countryCode);
    const reference = getCountryReference(countryCode);
    const outbound = recordsByOrigin.get(countryCode) ?? [];
    const inbound = recordsByDestination.get(countryCode) ?? [];
    const summary = summarizeTravel(outbound);
    const inboundSummary = summarizeTravel(inbound);
    const officialCount = (officialsByCountry.get(countryCode) ?? []).filter((official) =>
        matchingOfficialIds.has(official.id)
    ).length;

    const activeView = tracked ? selection.view : "inbound";
    const name = format.countryName(countryCode);
    const location = [tracked?.capital.city ?? reference?.capital, reference?.subregion]
        .filter(Boolean)
        .join(" · ");

    return (
        <div className="flex flex-col gap-4 p-4">
            <header className="flex items-start gap-3">
                <CountryFlag alpha2={reference?.alpha2} className="mt-1" size="lg" />
                <div className="flex min-w-0 flex-col gap-0.5">
                    <h2 className="font-semibold text-lg leading-tight">{name}</h2>
                    <p className="text-muted-foreground text-sm">{location}</p>
                    {tracked ? (
                        <p className="text-muted-foreground text-xs">{tracked.governmentSystem}</p>
                    ) : null}
                </div>
            </header>

            {tracked ? (
                <StatList
                    items={[
                        { label: t("stats.officials"), value: format.number(officialCount) },
                        { label: t("stats.trips"), value: format.number(summary.tripCount) },
                        { label: t("stats.countries"), value: format.number(summary.countryCount) },
                        { label: t("stats.upcoming"), value: format.number(summary.upcomingCount) },
                    ]}
                />
            ) : (
                <p className="flex gap-2 rounded-lg border bg-muted/40 p-3 text-muted-foreground text-sm">
                    <IconInfoCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
                    {t("country.untracked", { country: name })}
                </p>
            )}

            <Tabs onValueChange={handleViewChange} value={activeView}>
                <TabsList className="w-full">
                    {tracked ? (
                        <>
                            <TabsTrigger value="officials">
                                {t("country.tabs.officials")}
                            </TabsTrigger>
                            <TabsTrigger value="travel">
                                {t("country.tabs.travel", {
                                    countLabel: format.number(summary.tripCount),
                                })}
                            </TabsTrigger>
                        </>
                    ) : null}
                    <TabsTrigger value="inbound">
                        {t("country.tabs.inbound", {
                            countLabel: format.number(inboundSummary.tripCount),
                        })}
                    </TabsTrigger>
                </TabsList>

                {tracked ? (
                    <>
                        <TabsContent className="pt-2" value="officials">
                            <OfficialsList countryCode={countryCode} />
                        </TabsContent>
                        <TabsContent className="pt-2" value="travel">
                            {outbound.length === 0 ? (
                                <ClearFiltersEmpty
                                    description={t("country.noTripsDescription")}
                                    title={t("country.noTripsTitle")}
                                />
                            ) : (
                                <TravelTimeline
                                    onSelect={selectTrip}
                                    records={outbound}
                                    showOfficial
                                />
                            )}
                        </TabsContent>
                    </>
                ) : null}
                <TabsContent className="pt-2" value="inbound">
                    {inbound.length === 0 ? (
                        <ClearFiltersEmpty
                            description={t("country.noVisitsDescription", { country: name })}
                            title={t("country.noVisitsTitle")}
                        />
                    ) : (
                        <TravelTimeline
                            onSelect={selectTrip}
                            perspective="inbound"
                            records={inbound}
                        />
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}

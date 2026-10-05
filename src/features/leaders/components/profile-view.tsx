import { IconExternalLink } from "@tabler/icons-react";
import { getTranslations } from "next-intl/server";

import { CareerTimeline } from "@/features/leaders/components/career-timeline";
import { DirectoryFooter } from "@/features/leaders/components/directory-footer";
import { ProfileHero } from "@/features/leaders/components/profile-hero";
import { SectionHeading } from "@/features/leaders/components/section-heading";
import {
    TopDestinationsChart,
    TripsPerYearChart,
} from "@/features/leaders/components/travel-charts";
import { TripLog } from "@/features/leaders/components/trip-log";
import type { DirectoryContext, OfficialProfile } from "@/features/leaders/types/leaders.types";
import { countTripsByYear, rankDestinations } from "@/features/leaders/utils/leaders.utils";
import { getPrimaryPosition } from "@/lib/travel/officials.utils";
import { summarizeTravel } from "@/lib/travel/travel-summary.utils";

const TOP_DESTINATION_LIMIT = 8;

interface ProfileViewProps {
    context: DirectoryContext;
    profile: OfficialProfile;
}

/** An official's profile: who they are, the offices they held and everywhere they travelled. */
export async function ProfileView({ profile, context }: ProfileViewProps) {
    const t = await getTranslations("Leaders.profile");
    const { official, records } = profile;
    const summary = summarizeTravel(records);
    const years = countTripsByYear(records);
    const destinations = rankDestinations(records, TOP_DESTINATION_LIMIT);

    return (
        <>
            <ProfileHero official={official} summary={summary} />

            <section aria-labelledby="about" className="flex max-w-3xl flex-col gap-3">
                <SectionHeading id="about" title={t("about")} />
                <p className="text-pretty text-muted-foreground leading-relaxed">
                    {official.summary || t("noSummary")}
                </p>
                {official.sources.length > 0 ? (
                    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                        <span className="text-muted-foreground">{t("sources")}</span>
                        {official.sources.map((source) => (
                            <a
                                className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
                                href={source.url}
                                key={source.url}
                                rel="noopener noreferrer"
                                target="_blank"
                            >
                                {source.label}
                                <IconExternalLink
                                    aria-hidden
                                    className="size-3.5 text-muted-foreground"
                                />
                            </a>
                        ))}
                    </p>
                ) : null}
            </section>

            <div className="grid gap-10 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] lg:gap-12">
                <div className="lg:sticky lg:top-6 lg:self-start">
                    <CareerTimeline positions={official.positions} />
                </div>

                <div className="flex min-w-0 flex-col gap-8">
                    <section aria-labelledby="travel" className="flex flex-col gap-4">
                        <SectionHeading id="travel" title={t("travel")} />
                        {records.length === 0 ? (
                            <div className="flex flex-col gap-1 rounded-xl border border-dashed p-6 text-center">
                                <p className="font-medium">{t("noTripsTitle")}</p>
                                <p className="text-muted-foreground text-sm">
                                    {t("noTripsDescription", { name: official.fullName })}
                                </p>
                            </div>
                        ) : (
                            <div className="grid gap-3 xl:grid-cols-2">
                                {years.length > 0 ? <TripsPerYearChart years={years} /> : null}
                                {destinations.length > 0 ? (
                                    <TopDestinationsChart destinations={destinations} />
                                ) : null}
                            </div>
                        )}
                    </section>
                    {records.length > 0 ? (
                        <TripLog
                            currentTitle={getPrimaryPosition(official).title}
                            records={records}
                            today={context.today}
                        />
                    ) : null}
                </div>
            </div>

            <DirectoryFooter updatedOn={context.updatedOn} />
        </>
    );
}

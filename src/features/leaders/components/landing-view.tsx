import { getTranslations } from "next-intl/server";

import { DirectoryFooter } from "@/features/leaders/components/directory-footer";
import { LeaderCard } from "@/features/leaders/components/leader-card";
import { SectionHeading } from "@/features/leaders/components/section-heading";
import { StatTiles } from "@/features/leaders/components/stat-tiles";
import type { DirectoryContext, DirectoryOverview } from "@/features/leaders/types/leaders.types";
import { getTravelFormat } from "@/lib/travel/travel-format.server";

interface LandingViewProps {
    context: DirectoryContext;
    overview: DirectoryOverview;
}

/** The directory's front page: what it holds and who has been travelling most. */
export async function LandingView({ overview, context }: LandingViewProps) {
    const [t, format] = await Promise.all([getTranslations("Leaders.landing"), getTravelFormat()]);

    return (
        <>
            <section
                aria-labelledby="leaders-title"
                className="relative overflow-hidden rounded-2xl border bg-card px-5 py-8 md:px-10 md:py-12"
            >
                <div
                    aria-hidden
                    className="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full bg-primary/10 blur-3xl"
                />
                <div className="relative flex max-w-2xl flex-col gap-3">
                    <p className="font-medium text-muted-foreground text-xs uppercase tracking-widest">
                        {t("eyebrow")}
                    </p>
                    <h1
                        className="text-balance font-semibold text-3xl tracking-tight md:text-4xl"
                        id="leaders-title"
                    >
                        {t("title")}
                    </h1>
                    <p className="text-pretty text-muted-foreground md:text-lg">
                        {t("description")}
                    </p>
                </div>
                <StatTiles
                    className="relative mt-8"
                    items={[
                        {
                            label: t("stats.countries"),
                            value: format.number(overview.countryCount),
                        },
                        {
                            label: t("stats.officials"),
                            value: format.number(overview.officialCount),
                        },
                        { label: t("stats.trips"), value: format.number(overview.tripCount) },
                    ]}
                />
            </section>

            <section aria-labelledby="top-travellers" className="flex flex-col gap-4">
                <SectionHeading
                    caption={t("topCaption")}
                    id="top-travellers"
                    title={t("topTitle")}
                />
                {overview.topTravellers.length === 0 ? (
                    <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground text-sm">
                        {t("noTopTravellers")}
                    </p>
                ) : (
                    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {overview.topTravellers.map((entry) => (
                            <li key={entry.official.id}>
                                <LeaderCard
                                    entry={entry}
                                    figure={{
                                        label: t("recentTripsUnit", {
                                            count: entry.recentTripCount,
                                        }),
                                        value: entry.recentTripCount,
                                    }}
                                    showCountry
                                />
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <DirectoryFooter updatedOn={context.updatedOn} />
        </>
    );
}

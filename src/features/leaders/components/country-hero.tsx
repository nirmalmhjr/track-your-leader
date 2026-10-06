import { IconMap2 } from "@tabler/icons-react";
import { getTranslations } from "next-intl/server";

import { CountryFlag } from "@/components/shared/country-flag";
import { buttonVariants } from "@/components/ui/button";
import { ROUTES } from "@/configs/routes";
import { CountryDownloadButton } from "@/features/leaders/components/country-download-button";
import { StatTiles } from "@/features/leaders/components/stat-tiles";
import {
    COUNTRY_TAB_PARAM,
    COUNTRY_TABS_ANCHOR,
} from "@/features/leaders/constants/leaders.constants";
import type {
    CountryDirectory,
    CountryTab,
    DirectoryContext,
} from "@/features/leaders/types/leaders.types";
import { Link } from "@/i18n/navigation";
import { getCountryReference } from "@/lib/geo/country-reference";
import { getTravelFormat } from "@/lib/travel/travel-format.server";
import { cn } from "@/lib/utils";

/**
 * Inline because `flag-icons` ships unlayered CSS (`position: relative`, a fixed width) that
 * would override the equivalent Tailwind utilities.
 */
const FLAG_WASH_STYLE = {
    backgroundSize: "cover",
    height: "100%",
    position: "absolute",
    width: "100%",
} as const;

/** Link to one tab of the country page, scrolled to the tabs. */
const tabHref = (path: string, tab: CountryTab): string =>
    `${path}?${COUNTRY_TAB_PARAM}=${tab}#${COUNTRY_TABS_ANCHOR}`;

interface CountryHeroProps {
    context: DirectoryContext;
    directory: CountryDirectory;
}

/** The country's banner: flag, name, capital and how many officials and trips are on record. */
export async function CountryHero({ directory, context }: CountryHeroProps) {
    const [t, format] = await Promise.all([getTranslations("Leaders.country"), getTravelFormat()]);
    const { country, tenure, tripCount } = directory;
    const reference = getCountryReference(country.code);
    const name = format.countryName(country.code);
    const path = ROUTES.leadersCountry(country.code);

    return (
        <section
            aria-labelledby="country-title"
            className="relative overflow-hidden rounded-2xl border bg-card px-5 py-7 md:px-8 md:py-9"
        >
            {/* The flag, enlarged and blurred, tints the banner in the country's colours. */}
            {reference ? (
                <span
                    aria-hidden
                    className={cn(
                        "fi pointer-events-none scale-125 opacity-[0.12] blur-3xl",
                        `fi-${reference.alpha2.toLowerCase()}`
                    )}
                    style={{ ...FLAG_WASH_STYLE, inset: 0 }}
                />
            ) : null}
            <div className="relative flex flex-col gap-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-4">
                        <CountryFlag alpha2={reference?.alpha2} className="rounded-md" size="xl" />
                        <div className="flex min-w-0 flex-col gap-1">
                            <h1
                                className="text-balance font-semibold text-3xl tracking-tight md:text-4xl"
                                id="country-title"
                            >
                                {name}
                            </h1>
                            <p className="text-muted-foreground text-sm">
                                {[country.capital.city, country.governmentSystem]
                                    .filter(Boolean)
                                    .join(" · ")}
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Link
                            className={buttonVariants({ size: "sm", variant: "outline" })}
                            href={ROUTES.map(country.code)}
                        >
                            <IconMap2 data-icon="inline-start" />
                            {t("openOnMap")}
                        </Link>
                        {/* The samples are fictional, so they aren't offered as a download. */}
                        {context.updatedOn && tripCount > 0 ? (
                            <CountryDownloadButton
                                country={country}
                                today={context.today}
                                tripCount={tripCount}
                                updatedOn={context.updatedOn}
                            />
                        ) : null}
                    </div>
                </div>
                <StatTiles
                    items={[
                        {
                            label: t("stats.officials"),
                            value: format.number(tenure.current + tenure.former),
                        },
                        {
                            href: tabHref(path, "in-office"),
                            label: t("stats.inOffice"),
                            value: format.number(tenure.current),
                        },
                        {
                            href: tabHref(path, "former"),
                            label: t("stats.former"),
                            value: format.number(tenure.former),
                        },
                        { label: t("stats.trips"), value: format.number(tripCount) },
                    ]}
                />
            </div>
        </section>
    );
}

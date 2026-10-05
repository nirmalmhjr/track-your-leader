import { IconChevronRight, IconMap2 } from "@tabler/icons-react";
import { getTranslations } from "next-intl/server";

import { CountryFlag } from "@/components/shared/country-flag";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { badgeVariants } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ROUTES } from "@/configs/routes";
import { CopyLinkButton } from "@/features/leaders/components/copy-link-button";
import { StatTiles } from "@/features/leaders/components/stat-tiles";
import { Link } from "@/i18n/navigation";
import { getCountryReference } from "@/lib/geo/country-reference";
import { getCurrentPosition, getPrimaryPosition } from "@/lib/travel/officials.utils";
import { getTravelFormat } from "@/lib/travel/travel-format.server";
import { cn, getInitials } from "@/lib/utils";
import type { Official, TravelSummary } from "@/types/travel.types";

const PHOTO_WIDTH_PATTERN = /width=\d+/;
/** Commons serves thumbnails at any width; the hero shows the photo at up to 144px. */
const HERO_PHOTO_WIDTH = 320;

/**
 * The flag, enlarged and blurred, tints the top of the banner. Inline because `flag-icons`
 * ships unlayered CSS (`position: relative`, a fixed width) that would override Tailwind.
 */
const FLAG_WASH_STYLE = {
    backgroundSize: "cover",
    height: "10rem",
    left: 0,
    position: "absolute",
    top: 0,
    width: "100%",
} as const;

const toHeroPhoto = (url: string): string =>
    url.replace(PHOTO_WIDTH_PATTERN, `width=${HERO_PHOTO_WIDTH}`);

async function Breadcrumb({ official }: { official: Official }) {
    const [t, format] = await Promise.all([getTranslations("Leaders"), getTravelFormat()]);
    const reference = getCountryReference(official.countryCode);
    const linkClass =
        "rounded-sm outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50";

    return (
        <nav aria-label={t("profile.breadcrumb")}>
            <ol className="flex min-w-0 items-center gap-1.5 text-muted-foreground text-sm">
                <li>
                    <Link className={linkClass} href={ROUTES.LEADERS}>
                        {t("nav.leaders")}
                    </Link>
                </li>
                <IconChevronRight aria-hidden className="size-3.5 shrink-0" />
                <li>
                    <Link
                        className={cn(linkClass, "flex items-center gap-1.5")}
                        href={ROUTES.leadersCountry(official.countryCode)}
                    >
                        <CountryFlag alpha2={reference?.alpha2} size="sm" />
                        {format.countryName(official.countryCode)}
                    </Link>
                </li>
                <IconChevronRight aria-hidden className="size-3.5 shrink-0" />
                <li aria-current="page" className="min-w-0 truncate text-foreground">
                    {official.fullName}
                </li>
            </ol>
        </nav>
    );
}

interface ProfileHeroProps {
    official: Official;
    summary: TravelSummary;
}

/** Who the official is, at a glance: photo, office, country, party and travel figures. */
export async function ProfileHero({ official, summary }: ProfileHeroProps) {
    const [t, tExplorer, format] = await Promise.all([
        getTranslations("Leaders.profile"),
        getTranslations("Explorer"),
        getTravelFormat(),
    ]);
    const position = getPrimaryPosition(official);
    const isInOffice = getCurrentPosition(official) !== null;
    const reference = getCountryReference(official.countryCode);

    return (
        <div className="flex flex-col gap-4">
            <Breadcrumb official={official} />
            <section
                aria-labelledby="profile-name"
                className="relative overflow-hidden rounded-2xl border bg-card"
            >
                {reference ? (
                    <span
                        aria-hidden
                        className={cn(
                            "fi pointer-events-none scale-125 opacity-[0.14] blur-3xl",
                            `fi-${reference.alpha2.toLowerCase()}`
                        )}
                        style={FLAG_WASH_STYLE}
                    />
                ) : null}
                <div className="relative flex flex-col gap-6 p-5 md:flex-row md:items-start md:p-8">
                    <Avatar className="size-28 rounded-2xl after:rounded-2xl md:size-36">
                        {official.photoUrl ? (
                            <AvatarImage
                                alt=""
                                className="rounded-2xl"
                                src={toHeroPhoto(official.photoUrl)}
                            />
                        ) : null}
                        <AvatarFallback className="rounded-2xl font-medium text-3xl">
                            {getInitials(official.fullName)}
                        </AvatarFallback>
                    </Avatar>

                    <div className="flex min-w-0 flex-1 flex-col gap-3">
                        <div className="flex flex-wrap gap-1.5">
                            <span
                                className={badgeVariants({
                                    variant: isInOffice ? "default" : "secondary",
                                })}
                            >
                                {isInOffice ? t("inOffice") : t("former")}
                            </span>
                            {position.categories.map((category) => (
                                <span
                                    className={badgeVariants({ variant: "outline" })}
                                    key={category}
                                >
                                    {tExplorer(`roles.${category}`)}
                                </span>
                            ))}
                        </div>
                        <div className="flex flex-col gap-1">
                            <h1
                                className="text-balance font-semibold text-3xl tracking-tight md:text-4xl"
                                id="profile-name"
                            >
                                {official.fullName}
                            </h1>
                            <p className="text-lg">
                                {isInOffice
                                    ? position.title
                                    : tExplorer("official.formerTitle", { title: position.title })}
                            </p>
                            <p className="flex min-w-0 items-center gap-1.5 text-muted-foreground text-sm">
                                <CountryFlag alpha2={reference?.alpha2} size="sm" />
                                <span className="truncate">
                                    {[format.countryName(official.countryCode), official.party]
                                        .filter(Boolean)
                                        .join(" · ")}
                                </span>
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1">
                            <Link
                                className={buttonVariants({ size: "sm", variant: "outline" })}
                                href={ROUTES.map(official.countryCode, official.id)}
                            >
                                <IconMap2 data-icon="inline-start" />
                                {t("showOnMap")}
                            </Link>
                            <CopyLinkButton />
                        </div>
                    </div>
                </div>
                <div className="relative border-t p-5 md:px-8">
                    <StatTiles
                        items={[
                            {
                                label: tExplorer("stats.trips"),
                                value: format.number(summary.tripCount),
                            },
                            {
                                label: tExplorer("stats.countries"),
                                value: format.number(summary.countryCount),
                            },
                            {
                                label: tExplorer("stats.daysAbroad"),
                                value: format.number(summary.daysAbroad),
                            },
                            {
                                label: tExplorer("stats.upcoming"),
                                value: format.number(summary.upcomingCount),
                            },
                        ]}
                    />
                </div>
            </section>
        </div>
    );
}

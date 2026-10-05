"use client";

import { IconChevronRight, IconLink, IconMap2 } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { toast } from "sonner";

import { CountryFlag } from "@/components/shared/country-flag";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { StatTiles } from "@/features/leaders/components/stat-tiles";
import { useDirectoryFormat } from "@/features/leaders/hooks/use-directory-format";
import { getCountryPath, getMapHref, LEADERS_PATH } from "@/features/leaders/utils/leaders-paths";
import type { TravelSummary } from "@/features/travel-explorer/types/explorer.types";
import type { Official } from "@/features/travel-explorer/types/travel.types";
import {
    getCurrentPosition,
    getPrimaryPosition,
} from "@/features/travel-explorer/utils/filters.utils";
import { Link } from "@/i18n/navigation";
import { getCountryReference } from "@/lib/geo/country-reference";
import { cn, getInitials } from "@/lib/utils";

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

function Breadcrumb({ official }: { official: Official }) {
    const t = useTranslations("Leaders");
    const format = useDirectoryFormat();
    const reference = getCountryReference(official.countryCode);
    const linkClass =
        "rounded-sm outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50";

    return (
        <nav aria-label={t("profile.breadcrumb")}>
            <ol className="flex min-w-0 items-center gap-1.5 text-muted-foreground text-sm">
                <li>
                    <Link className={linkClass} href={LEADERS_PATH}>
                        {t("nav.leaders")}
                    </Link>
                </li>
                <IconChevronRight aria-hidden className="size-3.5 shrink-0" />
                <li>
                    <Link
                        className={cn(linkClass, "flex items-center gap-1.5")}
                        href={getCountryPath(official.countryCode)}
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
export function ProfileHero({ official, summary }: ProfileHeroProps) {
    const t = useTranslations("Leaders.profile");
    const tExplorer = useTranslations("Explorer");
    const format = useDirectoryFormat();
    const position = getPrimaryPosition(official);
    const isInOffice = getCurrentPosition(official) !== null;
    const reference = getCountryReference(official.countryCode);

    const copyLink = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            toast.success(t("copied"));
        } catch {
            // Clipboard access can be refused; the address bar still has the link.
        }
    }, [t]);

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
                            <Badge variant={isInOffice ? "default" : "secondary"}>
                                {isInOffice ? t("inOffice") : t("former")}
                            </Badge>
                            {position.categories.map((category) => (
                                <Badge key={category} variant="outline">
                                    {tExplorer(`roles.${category}`)}
                                </Badge>
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
                                href={getMapHref(official.countryCode, official.id)}
                            >
                                <IconMap2 data-icon="inline-start" />
                                {t("showOnMap")}
                            </Link>
                            <Button onClick={copyLink} size="sm" variant="ghost">
                                <IconLink data-icon="inline-start" />
                                {t("copyLink")}
                            </Button>
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

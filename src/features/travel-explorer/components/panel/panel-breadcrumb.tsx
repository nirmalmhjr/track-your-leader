"use client";

import { IconArrowLeft, IconChevronRight, IconWorld } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useCallback } from "react";

import { CountryFlag } from "@/components/shared/country-flag";
import { Button } from "@/components/ui/button";
import { useExplorerData } from "@/features/travel-explorer/hooks/use-explorer-data";
import { useExplorerFormat } from "@/features/travel-explorer/hooks/use-explorer-format";
import { useExplorerState } from "@/features/travel-explorer/hooks/use-explorer-state";
import type { ExplorerLevel } from "@/features/travel-explorer/types/explorer.types";
import { getCountryReference } from "@/lib/geo/country-reference";
import { cn } from "@/lib/utils";

interface Crumb {
    icon?: ReactNode;
    label: string;
    level: ExplorerLevel;
}

function CrumbLink({
    crumb,
    onNavigate,
}: {
    crumb: Crumb;
    onNavigate: (level: ExplorerLevel) => void;
}) {
    const handleClick = useCallback(() => onNavigate(crumb.level), [onNavigate, crumb.level]);

    return (
        <button
            className="flex max-w-36 items-center gap-1.5 rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            onClick={handleClick}
            type="button"
        >
            {crumb.icon}
            <span className="truncate">{crumb.label}</span>
        </button>
    );
}

/** Shows where the user is in the drill-down and lets them jump back to any level. */
export function PanelBreadcrumb() {
    const t = useTranslations("Explorer.breadcrumb");
    const format = useExplorerFormat();
    const { officialById } = useExplorerData();
    const { selection, level, goToLevel, goUp } = useExplorerState();

    const crumbs: Crumb[] = [
        { icon: <IconWorld aria-hidden className="size-3.5" />, label: t("world"), level: "world" },
    ];
    if (selection.country) {
        crumbs.push({
            icon: <CountryFlag alpha2={getCountryReference(selection.country)?.alpha2} size="sm" />,
            label: format.countryName(selection.country),
            level: "country",
        });
    }
    if (selection.official) {
        crumbs.push({
            label: officialById.get(selection.official)?.fullName ?? t("official"),
            level: "official",
        });
    }
    if (selection.trip) {
        crumbs.push({ label: t("trip"), level: "trip" });
    }

    return (
        <div className="flex min-w-0 items-center gap-1">
            {level === "world" ? null : (
                <Button
                    aria-label={t("back")}
                    className="-ml-1.5 shrink-0"
                    onClick={goUp}
                    size="icon-sm"
                    variant="ghost"
                >
                    <IconArrowLeft />
                </Button>
            )}
            <nav aria-label={t("label")} className="min-w-0">
                <ol className="flex min-w-0 items-center gap-1 text-sm">
                    {crumbs.map((crumb, index) => {
                        const isCurrent = index === crumbs.length - 1;
                        return (
                            <li
                                className={cn(
                                    "flex items-center gap-1",
                                    isCurrent ? "min-w-0" : "shrink-0"
                                )}
                                key={crumb.level}
                            >
                                {index > 0 ? (
                                    <IconChevronRight
                                        aria-hidden
                                        className="size-3.5 shrink-0 text-muted-foreground"
                                    />
                                ) : null}
                                {isCurrent ? (
                                    <span
                                        aria-current="page"
                                        className="flex min-w-0 items-center gap-1.5 font-medium"
                                    >
                                        {crumb.icon}
                                        <span className="truncate">{crumb.label}</span>
                                    </span>
                                ) : (
                                    <CrumbLink crumb={crumb} onNavigate={goToLevel} />
                                )}
                            </li>
                        );
                    })}
                </ol>
            </nav>
        </div>
    );
}

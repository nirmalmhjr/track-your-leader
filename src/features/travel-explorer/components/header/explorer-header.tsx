"use client";

import { IconRoute } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { useCallback } from "react";

import { badgeVariants } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ExplorerSearch } from "@/features/travel-explorer/components/header/explorer-search";
import { ExplorerSettingsMenu } from "@/features/travel-explorer/components/header/explorer-settings-menu";
import { TRAVEL_DATA_SOURCE } from "@/features/travel-explorer/data/travel-dataset";
import { useExplorerState } from "@/features/travel-explorer/hooks/use-explorer-state";
import { cn } from "@/lib/utils";

/** Slim application bar: brand, a notice while showing sample data, search and settings. */
export function ExplorerHeader() {
    const t = useTranslations("Explorer.app");
    const { goToLevel } = useExplorerState();
    const goToWorld = useCallback(() => goToLevel("world"), [goToLevel]);

    return (
        <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-sidebar px-3 md:px-4">
            <button
                className="flex min-w-0 items-center gap-2 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                onClick={goToWorld}
                type="button"
            >
                <span
                    aria-hidden
                    className="flex size-7 shrink-0 items-center justify-center rounded-md bg-foreground text-background"
                >
                    <IconRoute className="size-4" />
                </span>
                <span className="truncate font-semibold text-sm tracking-tight">{t("name")}</span>
            </button>

            {TRAVEL_DATA_SOURCE === "sample" ? (
                <Tooltip>
                    <TooltipTrigger
                        render={
                            <button
                                className={cn(
                                    badgeVariants({ variant: "outline" }),
                                    "hidden cursor-help sm:inline-flex"
                                )}
                                type="button"
                            />
                        }
                    >
                        {t("sampleData")}
                    </TooltipTrigger>
                    <TooltipContent className="max-w-64" side="bottom">
                        {t("sampleDataDescription")}
                    </TooltipContent>
                </Tooltip>
            ) : null}

            <div className="ml-auto flex items-center gap-1.5">
                <ExplorerSearch />
                <ExplorerSettingsMenu />
            </div>
        </header>
    );
}

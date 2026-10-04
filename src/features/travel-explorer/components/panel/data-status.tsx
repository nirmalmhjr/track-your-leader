"use client";

import { IconCloudOff, IconRefresh } from "@tabler/icons-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { useExplorerData } from "@/features/travel-explorer/hooks/use-explorer-data";

/** Shown in the panel while the travel data loads, or when it couldn't be loaded. */
export function DataStatus() {
    const t = useTranslations("Explorer.data");
    const { retry, status } = useExplorerData();

    if (status === "loading") {
        return (
            <p className="flex items-center gap-2 p-4 text-muted-foreground text-sm" role="status">
                <Spinner />
                {t("loading")}
            </p>
        );
    }
    return (
        <Empty className="m-4 border">
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <IconCloudOff />
                </EmptyMedia>
                <EmptyTitle className="text-sm">{t("errorTitle")}</EmptyTitle>
                <EmptyDescription>{t("errorDescription")}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
                <Button onClick={retry} size="sm" variant="outline">
                    <IconRefresh data-icon="inline-start" />
                    {t("retry")}
                </Button>
            </EmptyContent>
        </Empty>
    );
}

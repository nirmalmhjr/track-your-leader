"use client";

import { IconMapPinOff, IconRefresh } from "@tabler/icons-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

/** Placeholder shaped like the world projection while the map geometry loads. */
export function MapLoadingState() {
    const t = useTranslations("Explorer.map");

    return (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
            <Skeleton className="aspect-[2.05/1] w-[min(80%,56rem)] rounded-[45%/50%]" />
            <p className="flex items-center gap-2 text-muted-foreground text-sm" role="status">
                <Spinner />
                {t("loading")}
            </p>
        </div>
    );
}

/** Shown when the map geometry fails to load, with a way to try again. */
export function MapErrorState({ onRetry }: { onRetry: () => void }) {
    const t = useTranslations("Explorer.map");

    return (
        <div className="absolute inset-0 flex items-center justify-center p-6">
            <Empty className="max-w-sm border bg-background">
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <IconMapPinOff />
                    </EmptyMedia>
                    <EmptyTitle>{t("errorTitle")}</EmptyTitle>
                    <EmptyDescription>{t("errorDescription")}</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                    <Button onClick={onRetry} variant="outline">
                        <IconRefresh data-icon="inline-start" />
                        {t("retry")}
                    </Button>
                </EmptyContent>
            </Empty>
        </div>
    );
}

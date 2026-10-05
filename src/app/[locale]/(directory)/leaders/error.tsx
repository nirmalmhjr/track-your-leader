"use client";

import { IconAlertTriangle } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

interface LeadersErrorProps {
    error: Error & { digest?: string };
    reset: () => void;
}

/** Shown when the directory data can't be read, with a way to try again. */
export default function LeadersError({ error, reset }: LeadersErrorProps) {
    const t = useTranslations("Explorer.data");

    useEffect(() => {
        // Surfaces the failure in the browser console; the server has logged it already.
        console.error(error);
    }, [error]);

    return (
        <div className="flex min-h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <IconAlertTriangle aria-hidden className="size-8 text-muted-foreground" />
            <h1 className="font-semibold text-lg">{t("errorTitle")}</h1>
            <p className="max-w-sm text-muted-foreground text-sm">{t("errorDescription")}</p>
            <Button onClick={reset} variant="outline">
                {t("retry")}
            </Button>
        </div>
    );
}

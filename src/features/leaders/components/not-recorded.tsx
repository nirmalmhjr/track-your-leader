"use client";

import { useTranslations } from "next-intl";

/** A dash for a value the sources don't record, read out as "Not recorded". */
export function NotRecorded() {
    const t = useTranslations("Leaders.country");

    return (
        <span className="text-muted-foreground">
            <span aria-hidden>—</span>
            <span className="sr-only">{t("notRecorded")}</span>
        </span>
    );
}

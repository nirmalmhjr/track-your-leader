"use client";

import { useTranslations } from "next-intl";

import { useExplorerData } from "@/features/travel-explorer/hooks/use-explorer-data";
import { useTravelFormat } from "@/hooks/use-travel-format";

/** Credits the data sources (required by the Wikipedia, GOV.UK and Canadian licences) or flags the fictional samples. */
export function DataAttribution() {
    const t = useTranslations("Explorer.panel");
    const format = useTravelFormat();
    const { dataSource, updatedOn } = useExplorerData();

    if (dataSource === "sample") {
        return (
            <p className="px-4 pt-2 pb-4 text-[11px] text-muted-foreground/80">{t("sampleData")}</p>
        );
    }
    return (
        <p className="px-4 pt-2 pb-4 text-[11px] text-muted-foreground/80">
            {t("attribution")}
            {updatedOn ? ` · ${t("updatedOn", { date: format.date(updatedOn) })}` : null}
        </p>
    );
}

"use client";

import { useTranslations } from "next-intl";

import {
    TRAVEL_DATA_SOURCE,
    TRAVEL_DATA_UPDATED_ON,
} from "@/features/travel-explorer/data/travel-dataset";
import { useExplorerFormat } from "@/features/travel-explorer/hooks/use-explorer-format";

/** Credits the data sources (required by Wikipedia's licence) or flags the fictional samples. */
export function DataAttribution() {
    const t = useTranslations("Explorer.panel");
    const format = useExplorerFormat();

    if (TRAVEL_DATA_SOURCE === "sample") {
        return (
            <p className="px-4 pt-2 pb-4 text-[11px] text-muted-foreground/80">{t("sampleData")}</p>
        );
    }
    return (
        <p className="px-4 pt-2 pb-4 text-[11px] text-muted-foreground/80">
            {t("attribution")}
            {TRAVEL_DATA_UPDATED_ON
                ? ` · ${t("updatedOn", { date: format.date(TRAVEL_DATA_UPDATED_ON) })}`
                : null}
        </p>
    );
}

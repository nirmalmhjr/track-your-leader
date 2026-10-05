"use client";

import { useTranslations } from "next-intl";

import { useDirectoryFormat } from "@/features/leaders/hooks/use-directory-format";
import type { IsoDate } from "@/features/travel-explorer/types/travel.types";

/** Credits the data sources, as their licences require, and says when the data was updated. */
export function DirectoryFooter({ updatedOn }: { updatedOn: IsoDate | null }) {
    const t = useTranslations("Explorer.panel");
    const format = useDirectoryFormat();

    return (
        <footer className="border-t pt-6 text-muted-foreground text-xs leading-relaxed">
            {updatedOn ? (
                <>
                    {t("attribution")} · {t("updatedOn", { date: format.date(updatedOn) })}
                </>
            ) : (
                t("sampleData")
            )}
        </footer>
    );
}

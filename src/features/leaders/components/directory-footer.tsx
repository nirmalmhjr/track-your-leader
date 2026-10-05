import { getTranslations } from "next-intl/server";

import { getTravelFormat } from "@/lib/travel/travel-format.server";
import type { IsoDate } from "@/types/travel.types";

/** Credits the data sources, as their licences require, and says when the data was updated. */
export async function DirectoryFooter({ updatedOn }: { updatedOn: IsoDate | null }) {
    const [t, format] = await Promise.all([getTranslations("Explorer.panel"), getTravelFormat()]);

    return (
        <footer className="border-t pt-6 text-muted-foreground text-xs leading-relaxed">
            {updatedOn
                ? `${t("attribution")} · ${t("updatedOn", { date: format.date(updatedOn) })}`
                : t("sampleData")}
        </footer>
    );
}

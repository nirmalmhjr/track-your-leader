"use client";

import { useTranslations } from "next-intl";

import { useExplorerData } from "@/features/travel-explorer/hooks/use-explorer-data";
import { useExplorerFormat } from "@/features/travel-explorer/hooks/use-explorer-format";
import type { IsoDate } from "@/features/travel-explorer/types/travel.types";
import { findMatchingPreset } from "@/features/travel-explorer/utils/date-presets.utils";

/**
 * Human-readable description of a date range, preferring preset names such as "Past 12 months".
 *
 * @returns Function that labels a `from`/`to` pair.
 */
export function useDateRangeLabel() {
    const t = useTranslations("Explorer.dates");
    const format = useExplorerFormat();
    const { today } = useExplorerData();

    return (from: IsoDate | null, to: IsoDate | null): string => {
        const preset = findMatchingPreset({ from, to }, today);
        if (preset) {
            return t(`presets.${preset}`);
        }
        if (from && to) {
            return format.dateRange(from, to);
        }
        if (from) {
            return t("fromDate", { date: format.date(from) });
        }
        return t("untilDate", { date: format.date(to ?? today) });
    };
}

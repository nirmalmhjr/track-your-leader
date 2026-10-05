"use client";

import { useTranslations } from "next-intl";

import { useExplorerData } from "@/features/travel-explorer/hooks/use-explorer-data";
import { findMatchingPreset } from "@/features/travel-explorer/utils/date-presets.utils";
import { useTravelFormat } from "@/hooks/use-travel-format";
import type { IsoDate } from "@/types/travel.types";

/**
 * Human-readable description of a date range, preferring preset names such as "Past 12 months".
 *
 * @returns Function that labels a `from`/`to` pair.
 */
export function useDateRangeLabel() {
    const t = useTranslations("Explorer.dates");
    const format = useTravelFormat();
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

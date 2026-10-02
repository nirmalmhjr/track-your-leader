import type { IsoDate } from "@/features/travel-explorer/types/travel.types";
import { addDays, addMonths } from "@/features/travel-explorer/utils/date.utils";

export const DATE_PRESETS = [
    "all",
    "past30",
    "past6m",
    "past12m",
    "thisYear",
    "lastYear",
    "next90",
    "upcoming",
] as const;

export type DatePreset = (typeof DATE_PRESETS)[number];

interface DateRange {
    from: IsoDate | null;
    to: IsoDate | null;
}

const DAYS_IN_MONTH_WINDOW = 30;
const DAYS_IN_QUARTER_WINDOW = 90;

/**
 * Resolves a relative date preset against today's date.
 *
 * @param preset - Preset identifier.
 * @param today - Reference date.
 * @returns Inclusive date range; `null` bounds are open-ended.
 */
export const getPresetRange = (preset: DatePreset, today: IsoDate): DateRange => {
    const year = Number(today.slice(0, 4));

    switch (preset) {
        case "past30":
            return { from: addDays(today, -DAYS_IN_MONTH_WINDOW), to: today };
        case "past6m":
            return { from: addMonths(today, -6), to: today };
        case "past12m":
            return { from: addMonths(today, -12), to: today };
        case "thisYear":
            return { from: `${year}-01-01`, to: `${year}-12-31` };
        case "lastYear":
            return { from: `${year - 1}-01-01`, to: `${year - 1}-12-31` };
        case "next90":
            return { from: today, to: addDays(today, DAYS_IN_QUARTER_WINDOW) };
        case "upcoming":
            return { from: today, to: null };
        default:
            return { from: null, to: null };
    }
};

/**
 * Finds the preset that produces exactly the given range.
 *
 * @param range - Active date range.
 * @param today - Reference date.
 * @returns The matching preset, or `null` for a custom range.
 */
export const findMatchingPreset = (range: DateRange, today: IsoDate): DatePreset | null =>
    DATE_PRESETS.find((preset) => {
        const candidate = getPresetRange(preset, today);
        return candidate.from === range.from && candidate.to === range.to;
    }) ?? null;

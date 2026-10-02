"use client";

import { IconCheck } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { type ChangeEvent, useCallback } from "react";

import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { TRAVEL_DATASET } from "@/features/travel-explorer/data/travel-dataset";
import { useExplorerData } from "@/features/travel-explorer/hooks/use-explorer-data";
import { useExplorerFormat } from "@/features/travel-explorer/hooks/use-explorer-format";
import { useExplorerState } from "@/features/travel-explorer/hooks/use-explorer-state";
import type { IsoDate } from "@/features/travel-explorer/types/travel.types";
import { getCalendarRange, isIsoDate } from "@/features/travel-explorer/utils/date.utils";
import {
    DATE_PRESETS,
    type DatePreset,
    findMatchingPreset,
    getPresetRange,
} from "@/features/travel-explorer/utils/date-presets.utils";
import { cn } from "@/lib/utils";

const ALL_MONTHS = "all";
const MONTH_INDEXES = Array.from({ length: 12 }, (_, index) => index);

const DATASET_YEARS = [
    ...new Set(
        TRAVEL_DATASET.records.flatMap((record) => [
            Number(record.startDate.slice(0, 4)),
            Number(record.endDate.slice(0, 4)),
        ])
    ),
].sort((a, b) => b - a);

function DatePresetButton({
    preset,
    isActive,
    onChoose,
}: {
    preset: DatePreset;
    isActive: boolean;
    onChoose: (preset: DatePreset) => void;
}) {
    const t = useTranslations("Explorer.dates");
    const handleClick = useCallback(() => onChoose(preset), [onChoose, preset]);

    return (
        <button
            aria-pressed={isActive}
            className={cn(
                "flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent",
                isActive && "font-medium"
            )}
            onClick={handleClick}
            type="button"
        >
            {t(`presets.${preset}`)}
            {isActive ? <IconCheck aria-hidden className="size-4" /> : null}
        </button>
    );
}

/** Preset rows for quick relative ranges, with the active preset checked. */
export function DatePresetList({ onSelect }: { onSelect?: () => void }) {
    const t = useTranslations("Explorer.dates");
    const { filters, setFilters } = useExplorerState();
    const { today } = useExplorerData();
    const activePreset = findMatchingPreset({ from: filters.from, to: filters.to }, today);

    const choosePreset = useCallback(
        (preset: DatePreset) => {
            setFilters(getPresetRange(preset, today));
            onSelect?.();
        },
        [onSelect, setFilters, today]
    );

    return (
        <ul aria-label={t("presetsLabel")} className="flex flex-col">
            {DATE_PRESETS.map((preset) => (
                <li key={preset}>
                    <DatePresetButton
                        isActive={preset === activePreset}
                        onChoose={choosePreset}
                        preset={preset}
                    />
                </li>
            ))}
        </ul>
    );
}

/** Exact from/to inputs using the native date picker, which works well on touch devices. */
export function CustomDateFields() {
    const t = useTranslations("Explorer.dates");
    const { filters, setFilters } = useExplorerState();

    const handleFromChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) =>
            setFilters({ from: isIsoDate(event.target.value) ? event.target.value : null }),
        [setFilters]
    );
    const handleToChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) =>
            setFilters({ to: isIsoDate(event.target.value) ? event.target.value : null }),
        [setFilters]
    );

    return (
        <FieldGroup className="grid grid-cols-2 gap-3">
            <Field>
                <FieldLabel htmlFor="travel-date-from">{t("from")}</FieldLabel>
                <Input
                    id="travel-date-from"
                    max={filters.to ?? undefined}
                    onChange={handleFromChange}
                    type="date"
                    value={filters.from ?? ""}
                />
            </Field>
            <Field>
                <FieldLabel htmlFor="travel-date-to">{t("to")}</FieldLabel>
                <Input
                    id="travel-date-to"
                    min={filters.from ?? undefined}
                    onChange={handleToChange}
                    type="date"
                    value={filters.to ?? ""}
                />
            </Field>
        </FieldGroup>
    );
}

interface CalendarPeriod {
    month: string;
    year: string;
}

/** Recognises a range that spans exactly one calendar year or month. */
const resolveCalendarPeriod = (from: IsoDate | null, to: IsoDate | null): CalendarPeriod | null => {
    if (!(from && to)) {
        return null;
    }

    const year = Number(from.slice(0, 4));
    const yearRange = getCalendarRange(year, null);
    if (from === yearRange.from && to === yearRange.to) {
        return { month: ALL_MONTHS, year: String(year) };
    }

    const month = MONTH_INDEXES.find((index) => {
        const range = getCalendarRange(year, index);
        return from === range.from && to === range.to;
    });
    return month === undefined ? null : { month: String(month), year: String(year) };
};

/** Year and month pickers that set the range to a whole calendar period. */
export function CalendarPeriodFields() {
    const t = useTranslations("Explorer.dates");
    const format = useExplorerFormat();
    const { filters, setFilters } = useExplorerState();

    const period = resolveCalendarPeriod(filters.from, filters.to);

    const selectedYear = period?.year ?? null;
    const selectedMonth = period?.month ?? null;

    const handleYearChange = useCallback(
        (year: string | null) => {
            if (!year) {
                return;
            }
            const month = selectedMonth ?? ALL_MONTHS;
            setFilters(getCalendarRange(Number(year), month === ALL_MONTHS ? null : Number(month)));
        },
        [selectedMonth, setFilters]
    );

    const handleMonthChange = useCallback(
        (month: string | null) => {
            if (!(month && selectedYear)) {
                return;
            }
            setFilters(
                getCalendarRange(Number(selectedYear), month === ALL_MONTHS ? null : Number(month))
            );
        },
        [selectedYear, setFilters]
    );

    const yearItems = DATASET_YEARS.map((year) => ({ label: String(year), value: String(year) }));
    const monthItems = [
        { label: t("allMonths"), value: ALL_MONTHS },
        ...MONTH_INDEXES.map((index) => ({ label: format.monthName(index), value: String(index) })),
    ];

    return (
        <FieldGroup className="grid grid-cols-2 gap-3">
            <Field>
                <FieldLabel htmlFor="travel-year">{t("year")}</FieldLabel>
                <Select items={yearItems} onValueChange={handleYearChange} value={selectedYear}>
                    <SelectTrigger className="w-full" id="travel-year">
                        <SelectValue placeholder={t("anyYear")} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            {yearItems.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                    {item.label}
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </Field>
            <Field data-disabled={!period}>
                <FieldLabel htmlFor="travel-month">{t("month")}</FieldLabel>
                <Select
                    disabled={!period}
                    items={monthItems}
                    onValueChange={handleMonthChange}
                    value={selectedMonth}
                >
                    <SelectTrigger className="w-full" id="travel-month">
                        <SelectValue placeholder={t("allMonths")} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            {monthItems.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                    {item.label}
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </Field>
        </FieldGroup>
    );
}

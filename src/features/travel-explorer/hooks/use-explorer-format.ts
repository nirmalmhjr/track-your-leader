"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";

import type { IsoDate } from "@/features/travel-explorer/types/travel.types";
import { countDaysInclusive, parseIsoDate } from "@/features/travel-explorer/utils/date.utils";
import { COUNTRY_NAMES_NE } from "@/lib/geo/country-names-ne";
import { getCountryReference } from "@/lib/geo/country-reference";
import {
    formatNepaliNumber,
    NEPALI_MONTH_NAMES,
    toDevanagariDigits,
} from "@/lib/i18n/nepali-format";
import type { CountryCode } from "@/types/geo.types";

/** Travel dates are calendar days, so they are always formatted in UTC to avoid day shifts. */
const UTC = "UTC";
const NEPALI_LOCALE = "ne";

const createRegionNames = (locale: string): Intl.DisplayNames | null => {
    try {
        return new Intl.DisplayNames([locale], { type: "region" });
    } catch {
        return null;
    }
};

const splitIsoDate = (value: IsoDate) => {
    const [year, month, day] = value.split("-").map(Number);
    return { day, monthIndex: month - 1, year };
};

/**
 * Locale-aware formatters for explorer dates, numbers and country names.
 *
 * Nepali is formatted explicitly rather than through `Intl`: most browsers lack Nepali locale
 * data, so the server and the browser would otherwise render different text.
 *
 * @returns Formatting helpers bound to the active locale.
 */
export function useExplorerFormat() {
    const format = useFormatter();
    const locale = useLocale();
    const t = useTranslations("Explorer.relative");
    const isNepali = locale === NEPALI_LOCALE;
    const regionNames = useMemo(() => createRegionNames(locale), [locale]);

    const number = (value: number): string =>
        isNepali ? formatNepaliNumber(value) : format.number(value);

    const countryName = (code: CountryCode): string => {
        const reference = getCountryReference(code);
        if (!reference) {
            return code;
        }
        if (isNepali) {
            return COUNTRY_NAMES_NE[code] ?? reference.name;
        }
        return regionNames?.of(reference.alpha2) ?? reference.name;
    };

    const monthName = (monthIndex: number): string =>
        isNepali
            ? NEPALI_MONTH_NAMES[monthIndex]
            : format.dateTime(new Date(Date.UTC(2000, monthIndex, 1)), {
                  month: "long",
                  timeZone: UTC,
              });

    const year = (value: string | number): string =>
        isNepali ? toDevanagariDigits(String(value)) : String(value);

    const date = (value: IsoDate): string => {
        if (isNepali) {
            const parts = splitIsoDate(value);
            return `${year(parts.year)} ${NEPALI_MONTH_NAMES[parts.monthIndex]} ${number(parts.day)}`;
        }
        return format.dateTime(parseIsoDate(value), {
            day: "numeric",
            month: "short",
            timeZone: UTC,
            year: "numeric",
        });
    };

    const dayMonth = (value: IsoDate): string => {
        if (isNepali) {
            const parts = splitIsoDate(value);
            return `${NEPALI_MONTH_NAMES[parts.monthIndex]} ${number(parts.day)}`;
        }
        return format.dateTime(parseIsoDate(value), {
            day: "numeric",
            month: "short",
            timeZone: UTC,
        });
    };

    // Built from single dates: Intl range formatting differs between server and browser ICU
    // builds (thin spaces), which would break hydration.
    const dateRange = (start: IsoDate, end: IsoDate): string => {
        if (start === end) {
            return date(start);
        }
        const isSameYear = start.slice(0, 4) === end.slice(0, 4);
        return `${isSameYear ? dayMonth(start) : date(start)} – ${date(end)}`;
    };

    const relativeDays = (value: IsoDate, today: IsoDate): string => {
        const offset = countDaysInclusive(today, value) - 1;
        if (offset === 0) {
            return t("today");
        }
        const days = Math.abs(offset);
        const params = { count: days, countLabel: number(days) };
        return offset > 0 ? t("inDays", params) : t("daysAgo", params);
    };

    return { countryName, date, dateRange, dayMonth, monthName, number, relativeDays, year };
}

export type ExplorerFormat = ReturnType<typeof useExplorerFormat>;

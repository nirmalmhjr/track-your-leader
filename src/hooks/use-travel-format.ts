"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import { use, useMemo } from "react";

import { CountryNamesContext } from "@/components/shared/country-names-provider";
import { createTravelFormat, type TravelFormat } from "@/lib/travel/travel-format";

/**
 * Locale-aware formatters for travel dates, numbers, places and country names in client
 * components. Server components use `getTravelFormat` instead.
 *
 * @returns Formatting helpers bound to the active locale.
 */
export function useTravelFormat(): TravelFormat {
    const format = useFormatter();
    const locale = useLocale();
    const t = useTranslations("Explorer.relative");
    const countryNames = use(CountryNamesContext);

    // One stable object per locale, so components can memoise on it.
    return useMemo(
        () =>
            createTravelFormat({
                countryNames,
                format,
                locale,
                relative: {
                    daysAgo: ({ count, countLabel }) => t("daysAgo", { count, countLabel }),
                    inDays: ({ count, countLabel }) => t("inDays", { count, countLabel }),
                    today: () => t("today"),
                },
            }),
        [countryNames, format, locale, t]
    );
}

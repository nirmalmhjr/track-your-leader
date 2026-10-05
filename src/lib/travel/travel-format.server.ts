import "server-only";

import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { cache } from "react";

import { buildCountryNames } from "@/lib/travel/country-names.server";
import { createTravelFormat, type TravelFormat } from "@/lib/travel/travel-format";

/**
 * Locale-aware formatters for travel dates, numbers, places and country names in server
 * components, with the same output as `useTravelFormat` in the browser.
 *
 * @returns Formatting helpers bound to the request's locale.
 */
export const getTravelFormat = cache(async (): Promise<TravelFormat> => {
    const [format, locale, t] = await Promise.all([
        getFormatter(),
        getLocale(),
        getTranslations("Explorer.relative"),
    ]);
    return createTravelFormat({
        countryNames: buildCountryNames(locale),
        format,
        locale,
        relative: {
            daysAgo: ({ count, countLabel }) => t("daysAgo", { count, countLabel }),
            inDays: ({ count, countLabel }) => t("inDays", { count, countLabel }),
            today: () => t("today"),
        },
    });
});

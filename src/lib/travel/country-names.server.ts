import "server-only";

import { COUNTRY_NAMES_NE } from "@/lib/geo/country-names-ne";
import { ALL_COUNTRY_REFERENCES } from "@/lib/geo/country-reference";
import type { CountryCode } from "@/types/geo.types";

const NEPALI_LOCALE = "ne";

const createRegionNames = (locale: string): Intl.DisplayNames | null => {
    try {
        return new Intl.DisplayNames([locale], { type: "region" });
    } catch {
        return null;
    }
};

/**
 * Every country's name in a locale, resolved once on the server. Browsers and Node ship
 * different locale data ("Palestine" vs "Palestinian Territories"), so server-rendered pages
 * take their names from here instead of asking the browser again while hydrating.
 *
 * @param locale - Active locale.
 * @returns Country names keyed by ISO alpha-3 code, with the English reference name as fallback.
 */
export const buildCountryNames = (locale: string): Record<CountryCode, string> => {
    const regionNames = locale === NEPALI_LOCALE ? null : createRegionNames(locale);
    const names: Record<CountryCode, string> = {};
    for (const reference of ALL_COUNTRY_REFERENCES) {
        names[reference.alpha3] =
            (locale === NEPALI_LOCALE
                ? COUNTRY_NAMES_NE[reference.alpha3]
                : regionNames?.of(reference.alpha2)) ?? reference.name;
    }
    return names;
};

import type { CountryCode } from "@/types/geo.types";

/** Root of the leaders directory. */
export const LEADERS_PATH = "/leaders";

/**
 * Country page of the directory, e.g. `/leaders/npl`.
 *
 * @param code - Country code.
 * @returns Locale-less path, for `Link` from `@/i18n/navigation`.
 */
export const getCountryPath = (code: CountryCode): string =>
    `${LEADERS_PATH}/${code.toLowerCase()}`;

/**
 * Profile page of an official, e.g. `/leaders/npl/bidya-devi-bhandari`.
 *
 * @param code - The official's country.
 * @param officialId - The official's id.
 * @returns Locale-less path, for `Link` from `@/i18n/navigation`.
 */
export const getProfilePath = (code: CountryCode, officialId: string): string =>
    `${getCountryPath(code)}/${encodeURIComponent(officialId)}`;

/**
 * The map explorer opened on a country, or on one of its officials.
 *
 * @param code - Country to open.
 * @param officialId - Official to open, if any.
 * @returns A `Link` href using the explorer's query parameters.
 */
export const getMapHref = (code: CountryCode, officialId?: string) => ({
    pathname: "/",
    query: officialId ? { country: code, official: officialId } : { country: code },
});

import type { CountryCode } from "@/types/geo.types";

/**
 * Locale-less paths of every page, for `Link`, `redirect` and `useRouter` from `@/i18n/navigation`.
 */
export const ROUTES = {
    HOME: "/",
    LEADERS: "/leaders",
    /**
     * Country page of the leaders directory, e.g. `/leaders/npl`.
     *
     * @param code - Country code.
     * @returns The page path.
     */
    leadersCountry: (code: CountryCode): string => `/leaders/${code.toLowerCase()}`,
    /**
     * Profile page of an official, e.g. `/leaders/npl/bidya-devi-bhandari`.
     *
     * @param code - The official's country.
     * @param officialId - The official's id.
     * @returns The page path.
     */
    leadersProfile: (code: CountryCode, officialId: string): string =>
        `/leaders/${code.toLowerCase()}/${encodeURIComponent(officialId)}`,
    /**
     * The map explorer opened on a country, or on one of its officials.
     *
     * @param code - Country to open.
     * @param officialId - Official to open, if any.
     * @returns A `Link` href using the explorer's query parameters.
     */
    map: (code: CountryCode, officialId?: string) => ({
        pathname: "/",
        query: officialId ? { country: code, official: officialId } : { country: code },
    }),
} as const;

import type { MetadataRoute } from "next";

import { leadersData } from "@/features/leaders/data/leaders-data.server";
import { getCountryPath, LEADERS_PATH } from "@/features/leaders/utils/leaders-paths";
import { routing } from "@/i18n/routing";
import { getBaseUrl } from "@/lib/utils";

/**
 * The `sitemap` function is used for sitemap.xml metadata used by search engines
 * @returns The metadata object
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = getBaseUrl();
    const lastModified = new Date();
    const countries = await leadersData.getCountryList(routing.defaultLocale);

    return [
        { changeFrequency: "daily", lastModified, priority: 0.7, url: `${baseUrl}/` },
        { changeFrequency: "daily", lastModified, priority: 0.6, url: `${baseUrl}${LEADERS_PATH}` },
        ...countries.map((country) => ({
            changeFrequency: "weekly" as const,
            lastModified,
            priority: 0.5,
            url: `${baseUrl}${getCountryPath(country.code)}`,
        })),
    ];
}

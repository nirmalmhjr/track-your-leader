import type { MetadataRoute } from "next";

import { getBaseUrl } from "@/lib/utils";

/**
 * The `sitemap` function is used for sitemap.xml metadata used by search engines
 * @returns The metadata object
 */
export default function sitemap(): MetadataRoute.Sitemap {
    return [
        {
            changeFrequency: "daily",
            lastModified: new Date(),
            priority: 0.7,
            url: `${getBaseUrl()}/`,
        },
    ];
}

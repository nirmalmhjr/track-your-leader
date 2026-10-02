import type { MetadataRoute } from "next";

import { getBaseUrl } from "@/lib/utils";

/**
 * The `robots` function is used for robots.txt metadata used by search engines
 * @returns The metadata object
 */
export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: "*",
                allow: "/",
            },
        ],
        sitemap: `${getBaseUrl()}/sitemap.xml`,
    };
}

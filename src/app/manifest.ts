import type { MetadataRoute } from "next";

/**
 * The `manifest` function is used for Progessive Web App (PWA) metadata
 * @returns The metadata object
 */
export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "nextjs-frontend-template",
        short_name: "nextjs-frontend-template",
        description: "Next.js frontend template",
        start_url: "/",
        display: "standalone",
        background_color: "#fff",
        theme_color: "#fff",
        icons: [
            {
                src: "/android-chrome-96x96.png",
                sizes: "96x96",
                type: "image/png",
            },
            {
                src: "/android-chrome-144x144.png",
                sizes: "144x144",
                type: "image/png",
            },
            {
                src: "/android-chrome-192x192.png",
                sizes: "192x192",
                type: "image/png",
            },
            {
                src: "/apple-touch-icon.png",
                sizes: "120x120",
                type: "image/png",
            },
        ],
    };
}

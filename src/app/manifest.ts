import type { MetadataRoute } from "next";

/**
 * The `manifest` function is used for Progessive Web App (PWA) metadata
 * @returns The metadata object
 */
export default function manifest(): MetadataRoute.Manifest {
    return {
        background_color: "#fff",
        description: "Next.js frontend template",
        display: "standalone",
        icons: [
            {
                sizes: "96x96",
                src: "/android-chrome-96x96.png",
                type: "image/png",
            },
            {
                sizes: "144x144",
                src: "/android-chrome-144x144.png",
                type: "image/png",
            },
            {
                sizes: "192x192",
                src: "/android-chrome-192x192.png",
                type: "image/png",
            },
            {
                sizes: "120x120",
                src: "/apple-touch-icon.png",
                type: "image/png",
            },
        ],
        name: "nextjs-frontend-template",
        short_name: "nextjs-frontend-template",
        start_url: "/",
        theme_color: "#fff",
    };
}

import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
    allowedDevOrigins: ["192.168.1.82"],
    // Enable compression
    compress: true,
    // Experimental features for Next.js 16.1
    experimental: {
        // Better tree-shaking for large icon/utility libraries
        optimizePackageImports: ["lucide-react", "date-fns", "recharts"],
    },

    // Security headers
    async headers() {
        return [
            {
                headers: [
                    {
                        key: "X-DNS-Prefetch-Control",
                        value: "on",
                    },
                    {
                        key: "X-Frame-Options",
                        value: "SAMEORIGIN",
                    },
                    {
                        key: "X-Content-Type-Options",
                        value: "nosniff",
                    },
                    {
                        key: "Referrer-Policy",
                        value: "origin-when-cross-origin",
                    },
                    {
                        key: "Permissions-Policy",
                        value: "camera=(), microphone=(), geolocation=()",
                    },
                ],
                source: "/(.*)",
            },
            // Files in `public/` are otherwise re-checked on every visit (`max-age=0`). Map
            // outlines and terrain tiles change only when rebuilt (`pnpm geo:*`): fresh for a
            // week, then refreshed in the background. The travel data changes daily: fresh for
            // five minutes, then shown at once while the newer copy loads.
            {
                headers: [
                    {
                        key: "Cache-Control",
                        value: "public, max-age=604800, stale-while-revalidate=2592000",
                    },
                ],
                source: "/geo/:path*",
            },
            {
                headers: [
                    {
                        key: "Cache-Control",
                        value: "public, max-age=300, stale-while-revalidate=86400",
                    },
                ],
                source: "/data/:path*",
            },
        ];
    },

    // Image optimization for external images (GitHub avatars)
    images: {
        formats: ["image/avif", "image/webp"],
        remotePatterns: [
            { hostname: "avatars.githubusercontent.com", protocol: "https" },
            { hostname: "picsum.photos", protocol: "https" },
            { hostname: "images.unsplash.com", protocol: "https" },
        ],
    },

    // Strict mode for better development practices
    reactStrictMode: true,
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);

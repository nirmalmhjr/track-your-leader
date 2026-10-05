import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
    client: {
        NEXT_PUBLIC_API_TIMEOUT: z.coerce.number().default(10_000),
        /** Backend API base URL. Optional until the backend exists; the app reads static files today. */
        NEXT_PUBLIC_API_URL: z.string().min(1).optional(),
        /** Public URL of the app, used for absolute links such as the sitemap. */
        NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
    },
    /** An empty value in `.env` (`NEXT_PUBLIC_APP_URL=`) counts as unset, so defaults apply. */
    emptyStringAsUndefined: true,
    runtimeEnv: {
        NEXT_PUBLIC_API_TIMEOUT: process.env.NEXT_PUBLIC_API_TIMEOUT,
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
        NODE_ENV: process.env.NODE_ENV,
    },
    shared: {
        NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    },
});

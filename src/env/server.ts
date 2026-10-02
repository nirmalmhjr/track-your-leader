import { createEnv } from "@t3-oss/env-nextjs";

export const env = createEnv({
    experimental__runtimeEnv: process.env,
    server: {
        // DATABASE_URL: z.url(),
    },
});

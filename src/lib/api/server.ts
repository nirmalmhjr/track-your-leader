import "server-only";

import { env } from "@/env/server";
import { getSession } from "@/lib/session";

import { createAuthenticatedClient } from "./create-authenticated-client";

/**
 * Server Axios client — reads the access token from the session cookie.
 * Only import from Server Components, Server Actions, or route handlers.
 */
export const apiServer = createAuthenticatedClient({
    baseURL: `${env.API_URL}/api`,
    timeout: env.API_TIMEOUT,
    resolveToken: async () => {
        const session = await getSession();
        return session?.accessToken;
    },
});

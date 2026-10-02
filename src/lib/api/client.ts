import { env } from "@/env/client";
import { getAccessToken } from "@/stores/auth-store";

import { createAuthenticatedClient } from "./create-authenticated-client";

/** Browser Axios client — reads the access token from the auth store (localStorage). */
export const api = createAuthenticatedClient({
    baseURL: `${env.NEXT_PUBLIC_API_URL}/api`,
    timeout: env.NEXT_PUBLIC_API_TIMEOUT,
    resolveToken: () => getAccessToken(),
});

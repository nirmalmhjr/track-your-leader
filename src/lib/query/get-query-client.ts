import { defaultShouldDehydrateQuery, isServer, QueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { cache } from "react";

/**
 * Decide whether a query should retry
 */
function shouldRetryQuery(failureCount: number, error: unknown) {
    if (process.env.NODE_ENV === "development") {
        console.log({ error, failureCount });
        return false;
    }

    if (failureCount >= 2) {
        return false;
    }

    if (error instanceof AxiosError && [401, 403].includes(error.response?.status ?? 0)) {
        return false;
    }

    return true;
}

function makeQueryClient() {
    return new QueryClient({
        defaultOptions: {
            dehydrate: {
                shouldDehydrateQuery: (query) =>
                    defaultShouldDehydrateQuery(query) || query.state.status === "pending",
            },
            queries: {
                gcTime: 10 * 60 * 1000, // 10 minutes
                refetchOnWindowFocus: process.env.NODE_ENV === "production",
                retry: shouldRetryQuery,
                staleTime: 5 * 60 * 1000, // 5 minutes
            },
        },
    });
}

let browserQueryClient: QueryClient | undefined;

const getServerQueryClient = cache(() => makeQueryClient());

/**
 * Returns a QueryClient for the current runtime.
 * - Server: one instance per request via React `cache()`
 * - Browser: singleton reused across navigations
 */
export function getQueryClient() {
    if (isServer) {
        return getServerQueryClient();
    }

    if (!browserQueryClient) {
        browserQueryClient = makeQueryClient();
    }

    return browserQueryClient;
}

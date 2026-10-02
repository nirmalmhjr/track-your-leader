import { defaultShouldDehydrateQuery, isServer, QueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { cache } from "react";

/**
 * Decide whether a query should retry
 */
function shouldRetryQuery(failureCount: number, error: unknown) {
    if (process.env.NODE_ENV === "development") {
        console.log({ failureCount, error });
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
            queries: {
                retry: shouldRetryQuery,
                refetchOnWindowFocus: process.env.NODE_ENV === "production",
                staleTime: 5 * 60 * 1000, // 5 minutes
                gcTime: 10 * 60 * 1000, // 10 minutes
            },
            dehydrate: {
                shouldDehydrateQuery: (query) =>
                    defaultShouldDehydrateQuery(query) || query.state.status === "pending",
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

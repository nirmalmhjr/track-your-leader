import axios, { type AxiosInstance } from "axios";

const DEFAULT_HEADERS = {
    Accept: "application/json",
    "Content-Type": "application/json",
} as const;

type TokenResolver = () => string | undefined | Promise<string | undefined>;

interface CreateAuthenticatedClientOptions {
    baseURL: string;
    resolveToken: TokenResolver;
    timeout: number;
}

/**
 * Creates an Axios instance that attaches `Authorization: Bearer <token>`
 * when a token resolver returns a value.
 */
export function createAuthenticatedClient({
    baseURL,
    timeout,
    resolveToken,
}: CreateAuthenticatedClientOptions): AxiosInstance {
    const client = axios.create({
        baseURL,
        headers: DEFAULT_HEADERS,
        timeout,
    });

    client.interceptors.request.use(async (config) => {
        const token = await resolveToken();

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
    });

    return client;
}

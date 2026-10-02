import axios, { type AxiosInstance } from "axios";

const DEFAULT_HEADERS = {
    "Content-Type": "application/json",
    Accept: "application/json",
} as const;

type TokenResolver = () => string | undefined | Promise<string | undefined>;

interface CreateAuthenticatedClientOptions {
    baseURL: string;
    timeout: number;
    resolveToken: TokenResolver;
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
        timeout,
        headers: DEFAULT_HEADERS,
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

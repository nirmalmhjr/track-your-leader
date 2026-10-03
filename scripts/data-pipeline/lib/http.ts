import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { PIPELINE_CONFIG } from "../config";
import { log } from "./log";

/** Minimum gap between requests to one host. Public APIs ask clients to stay gentle. */
const HOST_INTERVAL_MS: Readonly<Record<string, number>> = {
    "en.wikipedia.org": 400,
    "query.wikidata.org": 1000,
    "www.cia.gov": 400,
    "www.wikidata.org": 400,
};
const DEFAULT_INTERVAL_MS = 500;
const MAX_ATTEMPTS = 5;
const RETRY_BASE_MS = 3000;
const MS_PER_SECOND = 1000;
const MS_PER_HOUR = 3_600_000;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVER_ERROR = 500;

export interface RequestOptions {
    /** Form fields sent as a POST body (used for long SPARQL queries). */
    form?: Readonly<Record<string, string>>;
    headers?: Readonly<Record<string, string>>;
}

let bypassCache = false;
const nextSlotByHost = new Map<string, number>();

/** Ignore cached responses for the rest of the run (`--refresh`). */
export const setCacheBypass = (value: boolean): void => {
    bypassCache = value;
};

class HttpError extends Error {
    /** Wait requested by the server (`Retry-After`), in milliseconds. */
    readonly retryAfterMs: number;
    readonly status: number;

    constructor(url: string, status: number, retryAfterMs: number) {
        super(`HTTP ${status} for ${url}`);
        this.retryAfterMs = retryAfterMs;
        this.status = status;
    }
}

const isRetryable = (error: unknown): boolean =>
    !(error instanceof HttpError) ||
    error.status === HTTP_TOO_MANY_REQUESTS ||
    error.status >= HTTP_SERVER_ERROR;

/** Pauses every request to a host, e.g. after it answered "too many requests". */
const pauseHost = (host: string, milliseconds: number): void => {
    nextSlotByHost.set(host, Math.max(nextSlotByHost.get(host) ?? 0, Date.now() + milliseconds));
};

/** Reserves the next free request slot for a host and waits for it. */
const waitForSlot = async (host: string): Promise<void> => {
    const interval = HOST_INTERVAL_MS[host] ?? DEFAULT_INTERVAL_MS;
    const now = Date.now();
    const slot = Math.max(now, nextSlotByHost.get(host) ?? 0);
    nextSlotByHost.set(host, slot + interval);
    if (slot > now) {
        await sleep(slot - now);
    }
};

const cachePathFor = (url: string, options: RequestOptions): string => {
    const key = createHash("sha1")
        .update(url)
        .update(JSON.stringify(options.form ?? null))
        .digest("hex");
    return path.join(PIPELINE_CONFIG.cacheDir, new URL(url).host, `${key}.txt`);
};

const readCache = async (file: string): Promise<string | null> => {
    if (bypassCache) {
        return null;
    }
    try {
        const info = await stat(file);
        const ageHours = (Date.now() - info.mtimeMs) / MS_PER_HOUR;
        return ageHours < PIPELINE_CONFIG.cacheTtlHours ? await readFile(file, "utf8") : null;
    } catch {
        return null;
    }
};

const writeCache = async (file: string, body: string): Promise<void> => {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body, "utf8");
};

const request = async (url: string, options: RequestOptions): Promise<string> => {
    await waitForSlot(new URL(url).host);
    const response = await fetch(url, {
        body: options.form ? new URLSearchParams(options.form) : undefined,
        headers: { "User-Agent": PIPELINE_CONFIG.userAgent, ...options.headers },
        method: options.form ? "POST" : "GET",
    });
    if (!response.ok) {
        const retryAfter = Number(response.headers.get("retry-after")) || 0;
        throw new HttpError(url, response.status, retryAfter * MS_PER_SECOND);
    }
    return response.text();
};

/**
 * Fetches a URL as text with rate limiting, retries and a local cache.
 *
 * @param url - Address to fetch.
 * @param options - Optional POST form and extra headers.
 * @returns The response body.
 * @throws When every attempt fails, or immediately for non-retryable HTTP errors (e.g. 404).
 */
export const fetchText = async (url: string, options: RequestOptions = {}): Promise<string> => {
    const cacheFile = cachePathFor(url, options);
    const cached = await readCache(cacheFile);
    if (cached !== null) {
        return cached;
    }

    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        try {
            // biome-ignore lint/performance/noAwaitInLoops: retries must wait for the previous attempt.
            const body = await request(url, options);
            await writeCache(cacheFile, body);
            return body;
        } catch (error) {
            lastError = error;
            if (!isRetryable(error) || attempt === MAX_ATTEMPTS) {
                break;
            }
            const requested = error instanceof HttpError ? error.retryAfterMs : 0;
            const delay = Math.max(RETRY_BASE_MS * 2 ** (attempt - 1), requested);
            // Slow down every request to this host, not just this one.
            pauseHost(new URL(url).host, delay);
            log.warn(`Retrying in ${delay / MS_PER_SECOND}s: ${(error as Error).message}`);
            await sleep(delay);
        }
    }
    throw lastError instanceof Error ? lastError : new Error(`Request failed: ${url}`);
};

/**
 * Fetches and parses JSON. Callers validate the result with a schema.
 *
 * @param url - Address to fetch.
 * @param options - Optional POST form and extra headers.
 * @returns The parsed, still untyped, JSON value.
 */
export const fetchJson = async (url: string, options: RequestOptions = {}): Promise<unknown> =>
    JSON.parse(
        await fetchText(url, {
            ...options,
            headers: { Accept: "application/json", ...options.headers },
        })
    );

/**
 * Builds a URL with query parameters.
 *
 * @param base - URL without a query string.
 * @param params - Parameters to append.
 * @returns The full URL.
 */
export const withQuery = (base: string, params: Readonly<Record<string, string>>): string =>
    `${base}?${new URLSearchParams(params).toString()}`;

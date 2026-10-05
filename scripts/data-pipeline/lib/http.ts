import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { PIPELINE_CONFIG } from "../config";
import { log } from "./log";

/** Minimum gap between requests to one host. Public APIs ask clients to stay gentle. */
const HOST_INTERVAL_MS: Readonly<Record<string, number>> = {
    "api.github.com": 1000,
    "assets.publishing.service.gov.uk": 250,
    "en.wikipedia.org": 400,
    "es.wikipedia.org": 400,
    "fr.wikipedia.org": 400,
    "mofa.gov.np": 1500,
    "query.wikidata.org": 1000,
    "raw.githubusercontent.com": 250,
    "www.cia.gov": 400,
    "www.gov.uk": 250,
    "www.wikidata.org": 400,
};
const DEFAULT_INTERVAL_MS = 500;
const MAX_ATTEMPTS = 5;
/** Throttling clears with patience, so "too many requests" gets more and longer retries. */
const MAX_THROTTLED_ATTEMPTS = 9;
const MAX_RETRY_DELAY_MS = 120_000;
/** Each "too many requests" doubles the gap between requests to that host, up to this. */
const MAX_INTERVAL_MS = 5000;
const RETRY_BASE_MS = 3000;
const MS_PER_SECOND = 1000;
const MS_PER_HOUR = 3_600_000;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVER_ERROR = 500;

export interface RequestOptions {
    /** Form fields sent as a POST body (used for long SPARQL queries). */
    form?: Readonly<Record<string, string>>;
    headers?: Readonly<Record<string, string>>;
    /** How long a cached response stays fresh; defaults to `PIPELINE_CONFIG.cacheTtlHours`. */
    ttlHours?: number;
}

let bypassCache = false;
const nextSlotByHost = new Map<string, number>();
/** Gaps widened after a host throttled this run. */
const intervalByHost = new Map<string, number>();

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

const isThrottled = (error: unknown): boolean =>
    error instanceof HttpError && error.status === HTTP_TOO_MANY_REQUESTS;

const intervalFor = (host: string): number =>
    intervalByHost.get(host) ?? HOST_INTERVAL_MS[host] ?? DEFAULT_INTERVAL_MS;

/** Spaces out every later request to a host that said "too many requests". */
const slowDownHost = (host: string): void => {
    intervalByHost.set(host, Math.min(intervalFor(host) * 2, MAX_INTERVAL_MS));
};

/** Pauses every request to a host, e.g. after it answered "too many requests". */
const pauseHost = (host: string, milliseconds: number): void => {
    nextSlotByHost.set(host, Math.max(nextSlotByHost.get(host) ?? 0, Date.now() + milliseconds));
};

/** Reserves the next free request slot for a host and waits for it. */
const waitForSlot = async (host: string): Promise<void> => {
    const interval = intervalFor(host);
    const now = Date.now();
    const slot = Math.max(now, nextSlotByHost.get(host) ?? 0);
    nextSlotByHost.set(host, slot + interval);
    if (slot > now) {
        await sleep(slot - now);
    }
};

const cachePathFor = (url: string, options: RequestOptions, extension: string): string => {
    const key = createHash("sha1")
        .update(url)
        .update(JSON.stringify(options.form ?? null))
        .digest("hex");
    return path.join(PIPELINE_CONFIG.cacheDir, new URL(url).host, `${key}.${extension}`);
};

const isFresh = async (file: string, ttlHours: number): Promise<boolean> => {
    if (bypassCache) {
        return false;
    }
    try {
        const info = await stat(file);
        return (Date.now() - info.mtimeMs) / MS_PER_HOUR < ttlHours;
    } catch {
        return false;
    }
};

const send = async (url: string, options: RequestOptions): Promise<Response> => {
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
    return response;
};

/**
 * Downloads a URL into the cache (unless a fresh copy is there) with rate limiting and
 * retries, and returns the cache file's path.
 */
const download = async (
    url: string,
    options: RequestOptions,
    extension: string,
    read: (response: Response) => Promise<string | Uint8Array>
): Promise<string> => {
    const cacheFile = cachePathFor(url, options, extension);
    if (await isFresh(cacheFile, options.ttlHours ?? PIPELINE_CONFIG.cacheTtlHours)) {
        return cacheFile;
    }

    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_THROTTLED_ATTEMPTS; attempt += 1) {
        try {
            // biome-ignore lint/performance/noAwaitInLoops: retries must wait for the previous attempt.
            const body = await read(await send(url, options));
            await mkdir(path.dirname(cacheFile), { recursive: true });
            await writeFile(cacheFile, body);
            return cacheFile;
        } catch (error) {
            lastError = error;
            const throttled = isThrottled(error);
            if (
                !isRetryable(error) ||
                attempt >= (throttled ? MAX_THROTTLED_ATTEMPTS : MAX_ATTEMPTS)
            ) {
                break;
            }
            const requested = error instanceof HttpError ? error.retryAfterMs : 0;
            const delay = Math.min(
                Math.max(RETRY_BASE_MS * 2 ** (attempt - 1), requested),
                MAX_RETRY_DELAY_MS
            );
            // Slow down every request to this host, not just this one.
            const { host } = new URL(url);
            pauseHost(host, delay);
            if (throttled) {
                slowDownHost(host);
            }
            log.warn(`Retrying in ${delay / MS_PER_SECOND}s: ${(error as Error).message}`);
            await sleep(delay);
        }
    }
    throw lastError instanceof Error ? lastError : new Error(`Request failed: ${url}`);
};

/**
 * Fetches a URL as text with rate limiting, retries and a local cache.
 *
 * @param url - Address to fetch.
 * @param options - Optional POST form, extra headers and cache lifetime.
 * @returns The response body.
 * @throws When every attempt fails, or immediately for non-retryable HTTP errors (e.g. 404).
 */
export const fetchText = async (url: string, options: RequestOptions = {}): Promise<string> =>
    readFile(await download(url, options, "txt", (response) => response.text()), "utf8");

/**
 * Downloads a (possibly large or binary) file into the local cache.
 *
 * @param url - Address to fetch.
 * @param options - Extra headers and cache lifetime.
 * @returns Path of the cached file.
 */
export const fetchFile = (url: string, options: RequestOptions = {}): Promise<string> =>
    download(url, options, "bin", async (response) => new Uint8Array(await response.arrayBuffer()));

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

import { env } from "@/env/client";

/**
 * Returns the base URL of the application.
 *
 * Reads `NEXT_PUBLIC_APP_URL` through the typed env, which falls back to
 * `http://localhost:3000` when it isn't set.
 *
 * Why this exists:
 * - Enables environment-based URL configuration
 * - Prevents hardcoding production URLs
 * - Supports deployment flexibility (Vercel, Docker, etc.)
 *
 * Note:
 * `NEXT_PUBLIC_` prefix makes the variable available on the client side.
 *
 * @returns The resolved base URL string
 */
export const getBaseUrl = (): string => env.NEXT_PUBLIC_APP_URL;

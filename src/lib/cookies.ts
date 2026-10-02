import Cookies from "js-cookie";

const DEFAULT_MAX_AGE_DAYS = 7;

/**
 * Get a cookie value by name
 */
export function getCookie(name: string): string | undefined {
    if (typeof window === "undefined") {
        return undefined;
    }

    return Cookies.get(name);
}

/**
 * Set a cookie with name, value, and optional max age (in seconds)
 */
export function setCookie(
    name: string,
    value: string,
    maxAgeSeconds: number = 60 * 60 * 24 * DEFAULT_MAX_AGE_DAYS
): void {
    if (typeof window === "undefined") {
        return;
    }

    Cookies.set(name, value, {
        path: "/",
        expires: maxAgeSeconds / (60 * 60 * 24), // js-cookie expects days
    });
}

/**
 * Remove a cookie
 */
export function removeCookie(name: string): void {
    if (typeof window === "undefined") {
        return;
    }

    Cookies.remove(name, { path: "/" });
}

"use client";

import { useEffect, useState } from "react";

const CSS_URL_PATTERN = /url\(["']?([^"')]+)["']?\)/;
const resolvedUrls = new Map<string, string>();

/**
 * Reads the bundled flag image URL from the `flag-icons` stylesheet, which already maps every
 * country code to its fingerprinted asset, so no second copy of the flags is needed.
 */
const resolveFlagUrl = (alpha2: string): string | null => {
    const probe = document.createElement("span");
    probe.className = `fi fi-${alpha2}`;
    probe.style.position = "absolute";
    probe.style.visibility = "hidden";
    document.body.append(probe);
    const match = CSS_URL_PATTERN.exec(getComputedStyle(probe).backgroundImage);
    probe.remove();
    return match?.[1] ?? null;
};

/**
 * URL of a country's rectangular flag image, for drawing flags inside SVG.
 *
 * @param alpha2 - ISO 3166-1 alpha-2 code.
 * @returns The image URL once resolved in the browser, otherwise `null`.
 */
export function useFlagImageUrl(alpha2: string | null | undefined): string | null {
    const code = alpha2?.toLowerCase() ?? null;
    const [resolved, setResolved] = useState<{ code: string; url: string } | null>(null);

    useEffect(() => {
        if (!code || resolvedUrls.has(code)) {
            return;
        }
        const url = resolveFlagUrl(code);
        if (url) {
            resolvedUrls.set(code, url);
            setResolved({ code, url });
        }
    }, [code]);

    if (!code) {
        return null;
    }
    return resolvedUrls.get(code) ?? (resolved?.code === code ? resolved.url : null);
}

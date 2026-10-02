import { getRequestConfig } from "next-intl/server";

import { routing, type TLocales } from "@/i18n/routing";

/**
 * Message file namespaces
 */
const NAMESPACE_FILES = {
    HomePage: "HomePage",
} as const satisfies Record<string, string>;

type NamespaceFile = keyof typeof NAMESPACE_FILES;

async function loadNamespaceFile(locale: TLocales, file: NamespaceFile) {
    try {
        return (await import(`@/i18n/messages/${locale}/${file}.json`)).default;
    } catch {
        return (await import(`@/i18n/messages/${routing.defaultLocale}/${file}.json`)).default;
    }
}

async function loadMessages(locale: TLocales) {
    const entries = await Promise.all(
        (Object.entries(NAMESPACE_FILES) as [NamespaceFile, string][]).map(
            async ([file, namespaceKey]) => {
                const content = await loadNamespaceFile(locale, file);
                return [namespaceKey, content] as const;
            }
        )
    );

    return Object.fromEntries(entries);
}

export default getRequestConfig(async ({ requestLocale }) => {
    // This typically corresponds to the `[locale]` segment
    let locale = (await requestLocale) as TLocales;

    // Ensure that a valid locale is used
    if (!(locale && routing.locales.includes(locale))) {
        locale = routing.defaultLocale;
    }

    return {
        locale,
        messages: await loadMessages(locale),
        timeZone: "Asia/Kathmandu",
    };
});

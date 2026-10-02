import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
    // Used when no locale matches
    defaultLocale: "en",

    // Automatically redirect based on the user's preferred languages
    localeDetection: true,

    // The prefix strategy to use for the generated routes. "as-needed" means that the default locale won't have a prefix, while all other locales will.
    localePrefix: "as-needed",
    // A list of all locales that are supported
    locales: ["en", "ne", "es", "fr"],
});

export type TLocales = (typeof routing)["locales"][number];

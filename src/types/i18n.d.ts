import type homePageMessages from "@/i18n/messages/en/HomePage.json";
import type { routing } from "@/i18n/routing";

export interface AppMessages {
    HomePage: typeof homePageMessages;
}

declare module "next-intl" {
    interface AppConfig {
        Locale: (typeof routing.locales)[number];
        Messages: AppMessages;
    }
}

export type { AppMessages };

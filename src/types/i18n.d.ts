import type explorerMessages from "@/i18n/messages/en/Explorer.json";
import type { routing } from "@/i18n/routing";

export interface AppMessages {
    Explorer: typeof explorerMessages;
}

declare module "next-intl" {
    interface AppConfig {
        Locale: (typeof routing.locales)[number];
        Messages: AppMessages;
    }
}

export type { AppMessages };

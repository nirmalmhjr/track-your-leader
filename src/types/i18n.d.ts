import type downloadsMessages from "@/i18n/messages/en/Downloads.json";
import type explorerMessages from "@/i18n/messages/en/Explorer.json";
import type leadersMessages from "@/i18n/messages/en/Leaders.json";
import type { routing } from "@/i18n/routing";

export interface AppMessages {
    Downloads: typeof downloadsMessages;
    Explorer: typeof explorerMessages;
    Leaders: typeof leadersMessages;
}

declare module "next-intl" {
    interface AppConfig {
        Locale: (typeof routing.locales)[number];
        Messages: AppMessages;
    }
}

export type { AppMessages };

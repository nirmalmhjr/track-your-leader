"use client";

import { IconDeviceDesktop, IconMoon, IconSettings, IconSun } from "@tabler/icons-react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useCallback } from "react";

import { useThemeConfig } from "@/components/themes/active-theme";
import { THEMES } from "@/components/themes/theme.config";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type TLocales } from "@/i18n/routing";

const COLOR_MODES = [
    { icon: IconSun, value: "light" },
    { icon: IconMoon, value: "dark" },
    { icon: IconDeviceDesktop, value: "system" },
] as const;

/** Locales with a complete translation; others fall back to English and are not offered. */
const TRANSLATED_LOCALES: readonly TLocales[] = ["en", "ne"];

const LOCALE_NAMES: Readonly<Partial<Record<TLocales, string>>> = {
    en: "English",
    ne: "नेपाली",
};

/** Appearance and language settings, switching language without losing the current view. */
export function ExplorerSettingsMenu() {
    const t = useTranslations("Explorer.settings");
    const { theme, setTheme } = useTheme();
    const { activeTheme, setActiveTheme } = useThemeConfig();
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const changeLocale = useCallback(
        (value: string) => {
            const next = routing.locales.find((candidate) => candidate === value);
            if (!next) {
                return;
            }
            const query = searchParams.toString();
            router.replace(query ? `${pathname}?${query}` : pathname, { locale: next });
        },
        [pathname, router, searchParams]
    );

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={<Button aria-label={t("label")} size="icon-sm" variant="ghost" />}
            >
                <IconSettings />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuGroup>
                    <DropdownMenuLabel>{t("colorMode")}</DropdownMenuLabel>
                    <DropdownMenuRadioGroup onValueChange={setTheme} value={theme ?? "system"}>
                        {COLOR_MODES.map(({ icon: Icon, value }) => (
                            <DropdownMenuRadioItem key={value} value={value}>
                                <Icon aria-hidden />
                                {t(`modes.${value}`)}
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuLabel>{t("palette")}</DropdownMenuLabel>
                    <DropdownMenuRadioGroup onValueChange={setActiveTheme} value={activeTheme}>
                        {THEMES.map((option) => (
                            <DropdownMenuRadioItem key={option.value} value={option.value}>
                                {option.name}
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuLabel>{t("language")}</DropdownMenuLabel>
                    <DropdownMenuRadioGroup onValueChange={changeLocale} value={locale}>
                        {TRANSLATED_LOCALES.map((value) => (
                            <DropdownMenuRadioItem key={value} lang={value} value={value}>
                                {LOCALE_NAMES[value] ?? value}
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

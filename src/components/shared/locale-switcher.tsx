"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";

import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

/**
 * A component that allows the user to switch between locales.
 * @returns The locale switcher component.
 */
export const LocaleSwitcher = () => {
    const router = useRouter();
    const pathname = usePathname();
    const locale = useLocale();

    const localeMeta: Record<string, { label: string; flag: string }> = {
        en: { label: "English", flag: "🇺🇸" },
        ne: { label: "नेपाली", flag: "🇳🇵" },
    };

    // Handle the change event of the select element.
    const handleChange = (value: string | null): void => {
        if (!value) return;

        router.push(`/${value}${pathname}`);
        router.refresh();
    };

    const items = routing.locales.map((locale) => {
        const meta = localeMeta[locale] ?? {
            label: locale.toUpperCase(),
            flag: "",
        };

        return {
            label: `${meta.flag} ${meta.label}`,
            flag: meta.flag,
            value: locale,
        };
    });

    return (
        <Select items={items} onValueChange={handleChange} value={locale}>
            <SelectTrigger aria-label="lang-switcher" className="w-fit">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectGroup>
                    <SelectLabel>LANGUAGES</SelectLabel>
                    {items.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                            {item.label}
                        </SelectItem>
                    ))}
                </SelectGroup>
            </SelectContent>
        </Select>
    );
};

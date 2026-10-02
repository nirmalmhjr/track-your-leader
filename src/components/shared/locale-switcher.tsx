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
        en: { flag: "🇺🇸", label: "English" },
        ne: { flag: "🇳🇵", label: "नेपाली" },
    };

    // Handle the change event of the select element.
    const handleChange = (value: string | null): void => {
        if (!value) return;

        router.push(`/${value}${pathname}`);
        router.refresh();
    };

    const items = routing.locales.map((locale) => {
        const meta = localeMeta[locale] ?? {
            flag: "",
            label: locale.toUpperCase(),
        };

        return {
            flag: meta.flag,
            label: `${meta.flag} ${meta.label}`,
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

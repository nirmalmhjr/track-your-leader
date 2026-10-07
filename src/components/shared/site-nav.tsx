"use client";

import { IconMap2, IconUsers } from "@tabler/icons-react";
import { useTranslations } from "next-intl";

import { ROUTES } from "@/configs/routes";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
    { href: ROUTES.HOME, icon: IconMap2, key: "map" },
    { href: ROUTES.LEADERS, icon: IconUsers, key: "leaders" },
] as const;

const isActive = (pathname: string, href: string): boolean =>
    href === ROUTES.HOME
        ? pathname === ROUTES.HOME
        : pathname === href || pathname.startsWith(`${href}/`);

/**
 * The site's two sections, marking the one on screen. Every header places it just before the
 * settings menu, so the links stay put when moving between the map and the directory.
 */
export function SiteNav() {
    const t = useTranslations("Leaders.nav");
    const pathname = usePathname();

    return (
        <nav aria-label={t("label")} className="flex items-center gap-1">
            {NAV_ITEMS.map(({ href, icon: Icon, key }) => {
                const active = isActive(pathname, href);
                return (
                    <Link
                        aria-current={active ? "page" : undefined}
                        className={cn(
                            "flex h-8 items-center gap-1.5 rounded-md px-2 font-medium text-muted-foreground text-sm outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 sm:px-2.5",
                            active && "bg-muted text-foreground"
                        )}
                        href={href}
                        key={key}
                    >
                        <Icon aria-hidden className="size-4" />
                        <span className="sr-only sm:not-sr-only">{t(key)}</span>
                    </Link>
                );
            })}
        </nav>
    );
}

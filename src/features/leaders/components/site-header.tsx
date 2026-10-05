"use client";

import { IconMap2, IconRoute, IconUsers } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { Suspense } from "react";

import { LEADERS_PATH } from "@/features/leaders/utils/leaders-paths";
import { ExplorerSettingsMenu } from "@/features/travel-explorer/components/header/explorer-settings-menu";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
    { href: "/", icon: IconMap2, key: "map" },
    { href: LEADERS_PATH, icon: IconUsers, key: "leaders" },
] as const;

const isActive = (pathname: string, href: string): boolean =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

/** Application bar for the directory pages: brand, the two sections and settings. */
export function SiteHeader() {
    const t = useTranslations("Leaders.nav");
    const tApp = useTranslations("Explorer.app");
    const pathname = usePathname();

    return (
        <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-sidebar px-3 md:px-4">
            <Link
                className="flex min-w-0 items-center gap-2 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                href="/"
            >
                <span
                    aria-hidden
                    className="flex size-7 shrink-0 items-center justify-center rounded-md bg-foreground text-background"
                >
                    <IconRoute className="size-4" />
                </span>
                <span className="hidden truncate font-semibold text-sm tracking-tight sm:inline">
                    {tApp("name")}
                </span>
            </Link>

            <nav aria-label={t("label")} className="flex items-center gap-1">
                {NAV_ITEMS.map(({ href, icon: Icon, key }) => {
                    const active = isActive(pathname, href);
                    return (
                        <Link
                            aria-current={active ? "page" : undefined}
                            className={cn(
                                "flex h-8 items-center gap-1.5 rounded-md px-2.5 font-medium text-muted-foreground text-sm outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                                active && "bg-muted text-foreground"
                            )}
                            href={href}
                            key={key}
                        >
                            <Icon aria-hidden className="size-4" />
                            {t(key)}
                        </Link>
                    );
                })}
            </nav>

            <div className="ml-auto flex items-center">
                {/* The menu reads the query string, which would otherwise opt the page out of static rendering. */}
                <Suspense fallback={null}>
                    <ExplorerSettingsMenu />
                </Suspense>
            </div>
        </header>
    );
}

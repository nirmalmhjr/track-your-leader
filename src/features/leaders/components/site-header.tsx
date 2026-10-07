"use client";

import { IconRoute } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { Suspense } from "react";

import { SettingsMenu } from "@/components/shared/settings-menu";
import { SiteNav } from "@/components/shared/site-nav";
import { ROUTES } from "@/configs/routes";
import { Link } from "@/i18n/navigation";

/** Application bar for the directory pages: brand, the two sections and settings. */
export function SiteHeader() {
    const tApp = useTranslations("Explorer.app");

    return (
        <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-sidebar px-3 md:px-4">
            <Link
                className="flex min-w-0 items-center gap-2 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                href={ROUTES.HOME}
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

            <div className="ml-auto flex items-center gap-1.5">
                <SiteNav />
                {/* The menu reads the query string, which would otherwise opt the page out of static rendering. */}
                <Suspense fallback={null}>
                    <SettingsMenu />
                </Suspense>
            </div>
        </header>
    );
}

import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";

import { Providers } from "@/components/layout/providers";
import { fontVariables } from "@/components/themes/font.config";
import { DEFAULT_THEME } from "@/components/themes/theme.config";
import { META_THEME_COLORS, siteConfig } from "@/lib/config";
import { cn } from "@/lib/utils";

import "@/styles/globals.css";

import { notFound } from "next/navigation";
import { getMessages } from "next-intl/server";

import { routing, type TLocales } from "@/i18n/routing";

export const metadata: Metadata = {
    title: siteConfig.title,
    description: siteConfig.description,
};

export const viewport: Viewport = {
    themeColor: META_THEME_COLORS.light,
};

export default async function LocaleLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;

    if (!routing.locales.includes(locale as TLocales)) {
        // Ensure that the incoming `locale` is valid
        notFound();
    }

    /** Fetch the messages for the current locale to be used by the `NextIntlClientProvider` */
    const messages = await getMessages();

    const cookieStore = await cookies();
    const activeThemeValue = cookieStore.get("active_theme")?.value;
    const themeToApply = activeThemeValue || DEFAULT_THEME;

    return (
        <html data-theme={themeToApply} lang="en" suppressHydrationWarning>
            <head>
                <script
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: This is necessary to set the meta theme color based on user preference.
                    dangerouslySetInnerHTML={{
                        __html: `
                            try {
                                // Set meta theme color
                                if (localStorage.theme === 'dark' || ((!('theme' in localStorage) || localStorage.theme === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                                document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '${META_THEME_COLORS.dark}')
                                }
                            } catch (_) {}
                        `,
                    }}
                />
            </head>
            <body
                className={cn(
                    "overflow-hidden overscroll-none bg-background font-sans antialiased",
                    fontVariables
                )}
            >
                <Providers
                    activeThemeValue={themeToApply}
                    locale={locale as TLocales}
                    messages={messages}
                >
                    {children}
                </Providers>
            </body>
        </html>
    );
}

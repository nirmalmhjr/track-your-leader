"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { NextIntlClientProvider } from "next-intl";
import NextTopLoader from "nextjs-toploader";
import { NuqsAdapter } from "nuqs/adapters/next/app";

import { ThemeProvider } from "@/components/themes/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import type { TLocales } from "@/i18n/routing";

import { ActiveThemeProvider } from "../themes/active-theme";

interface ProvidersProps {
    activeThemeValue: string;
    locale: TLocales;
    // biome-ignore lint/suspicious/noExplicitAny: Messages can be of any shape depending on the locale and application needs; enforcing a specific type would reduce flexibility without significant benefits.
    messages: Record<string, any>;
    children: React.ReactNode;
}

export function Providers({ activeThemeValue, locale, messages, children }: ProvidersProps) {
    const queryClient = new QueryClient();

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kathmandu";

    return (
        <>
            <NextTopLoader color="var(--primary)" showSpinner={false} />

            <NuqsAdapter>
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    disableTransitionOnChange
                    enableColorScheme
                    enableSystem
                >
                    <NextIntlClientProvider locale={locale} messages={messages} timeZone={timezone}>
                        <QueryClientProvider client={queryClient}>
                            <Toaster />

                            <ActiveThemeProvider initialTheme={activeThemeValue}>
                                {children}
                            </ActiveThemeProvider>

                            <ReactQueryDevtools initialIsOpen={false} />
                        </QueryClientProvider>
                    </NextIntlClientProvider>
                </ThemeProvider>
            </NuqsAdapter>
        </>
    );
}

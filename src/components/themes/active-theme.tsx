"use client";

import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

import { STORAGE_KEYS } from "@/configs/storage";

import { DEFAULT_THEME } from "./theme.config";

function setThemeCookie(theme: string) {
    if (typeof window === "undefined") return;

    // biome-ignore lint/suspicious/noDocumentCookie: Setting theme cookie
    document.cookie = `${STORAGE_KEYS.THEME}=${theme}; path=/; max-age=31536000; SameSite=Lax; ${window.location.protocol === "https:" ? "Secure;" : ""}`;
}

interface ThemeContextType {
    activeTheme: string;
    setActiveTheme: (theme: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ActiveThemeProvider({
    children,
    initialTheme,
}: {
    children: ReactNode;
    initialTheme?: string;
}) {
    const themeToUse = initialTheme || DEFAULT_THEME;
    const [activeTheme, setActiveTheme] = useState<string>(themeToUse);

    useEffect(() => {
        // Only update if theme has changed
        const currentTheme = document.documentElement.getAttribute("data-theme");
        if (currentTheme === activeTheme) {
            // Still update cookie in case it's missing
            setThemeCookie(activeTheme);
        } else {
            setThemeCookie(activeTheme);

            // Remove existing data-theme attribute
            document.documentElement.removeAttribute("data-theme");

            // Remove any theme classes from body (cleanup)
            for (const className of Array.from(document.body.classList)) {
                if (className.startsWith("theme-")) {
                    document.body.classList.remove(className);
                }
            }

            // Set data-theme on html element
            if (activeTheme) {
                document.documentElement.setAttribute("data-theme", activeTheme);
            }
        }
    }, [activeTheme]);

    return (
        <ThemeContext.Provider value={{ activeTheme, setActiveTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useThemeConfig() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error("useThemeConfig must be used within an ActiveThemeProvider");
    }
    return context;
}

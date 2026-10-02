"use client";

import { IconBrightness } from "@tabler/icons-react";
import { useTheme } from "next-themes";
import { useCallback } from "react";

import { Button } from "@/components/ui/button";

export function ThemeModeToggle() {
    const { setTheme, resolvedTheme } = useTheme();

    const handleThemeToggle = useCallback(
        (e?: React.MouseEvent) => {
            const newMode = resolvedTheme === "dark" ? "light" : "dark";
            const root = document.documentElement;

            if (!document.startViewTransition) {
                setTheme(newMode);
                return;
            }

            // Set coordinates from the click event
            if (e) {
                root.style.setProperty("--x", `${e.clientX}px`);
                root.style.setProperty("--y", `${e.clientY}px`);
            }

            document.startViewTransition(() => {
                setTheme(newMode);
            });
        },
        [resolvedTheme, setTheme]
    );

    return (
        <Button
            className="group/toggle size-8"
            onClick={handleThemeToggle}
            size="icon"
            variant="secondary"
        >
            <IconBrightness />
            <span className="sr-only">Toggle theme</span>
        </Button>
    );
}

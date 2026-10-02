"use client";

import { useTranslations } from "next-intl";

import { LocaleSwitcher } from "@/components/shared/locale-switcher";
import { ThemeModeToggle } from "@/components/themes/theme-mode-toggle";
import { ThemeSelector } from "@/components/themes/theme-selector";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

import {
    CommitizenIcon,
    ESLintIcon,
    FramerMotionIcon,
    HuskyIcon,
    NextJsIcon,
    PlaywrightIcon,
    PrettierIcon,
    ReactIcon,
    TailwindIcon,
    TanStackQueryIcon,
    TestingLibraryIcon,
    TypeScriptIcon,
    ZodIcon,
} from "./icons";

const packages = [
    { name: "React 19", icon: <ReactIcon /> },
    { name: "Next.js 15", icon: <NextJsIcon /> },
    { name: "Tailwind 3.4", icon: <TailwindIcon /> },
    { name: "TypeScript 5", icon: <TypeScriptIcon /> },
    { name: "ESLint 9", icon: <ESLintIcon /> },
    { name: "Prettier", icon: <PrettierIcon /> },
    { name: "Husky (Pre-commit)", icon: <HuskyIcon /> },
    { name: "Commitizen", icon: <CommitizenIcon /> },
    { name: "Testing Library", icon: <TestingLibraryIcon /> },
    { name: "Playwright", icon: <PlaywrightIcon /> },
    { name: "Zod", icon: <ZodIcon /> },
    { name: "Framer Motion 11", icon: <FramerMotionIcon /> },
    { name: "TanStack Query", icon: <TanStackQueryIcon /> },
];

export default function Home() {
    const t = useTranslations("HomePage");

    return (
        <main className="flex flex-col items-center justify-center gap-5">
            <div className="container flex min-h-screen w-screen max-w-6xl flex-col items-center justify-center gap-20 border-x border-dashed px-6 py-4">
                <div className="flex w-full items-center justify-between">
                    <ThemeSelector />
                    <ThemeModeToggle />
                    <LocaleSwitcher />
                </div>
                <div className="relative flex size-full flex-col items-center justify-center gap-4">
                    <div className="flex flex-col items-center gap-4 p-6 text-center">
                        <h1 className="flex items-center gap-2 font-bold text-4xl tracking-tight">
                            {t("welcome")}
                        </h1>
                        <p className="max-w-lg text-lg">{t("description")}</p>

                        <div className="mt-6 flex max-w-4xl flex-wrap justify-center gap-6 bg-opacity-10 p-4">
                            {packages.map((pkg) => (
                                <div
                                    className="flex flex-col items-center gap-2 text-center"
                                    key={pkg.name}
                                >
                                    {pkg.icon}
                                    <span className="font-medium text-sm">{pkg.name}</span>
                                </div>
                            ))}
                        </div>

                        <Link className="mt-4" href="/get-started">
                            <Button size={"lg"}>{t("getStarted")}</Button>
                        </Link>
                    </div>
                </div>
            </div>
        </main>
    );
}

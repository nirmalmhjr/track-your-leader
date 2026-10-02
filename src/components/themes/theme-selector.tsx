"use client";

import { useThemeConfig } from "@/components/themes/active-theme";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import { Icons } from "../shared/icons";
import { THEMES } from "./theme.config";

export function ThemeSelector() {
    const { activeTheme, setActiveTheme } = useThemeConfig();

    const handleThemeChange = (value: string | null) => {
        if (value !== null) {
            setActiveTheme(value);
        }
    };

    return (
        <div className="flex items-center gap-2">
            <Label className="sr-only" htmlFor="theme-selector">
                Theme
            </Label>
            <Select onValueChange={handleThemeChange} value={activeTheme}>
                <SelectTrigger
                    className="justify-start *:data-[slot=select-value]:w-24"
                    id="theme-selector"
                >
                    <span className="hidden text-muted-foreground sm:block">
                        <Icons.palette />
                    </span>
                    <span className="block text-muted-foreground sm:hidden">Theme</span>
                    <SelectValue placeholder="Select a theme" />
                </SelectTrigger>
                <SelectContent align="end">
                    {THEMES.length > 0 && (
                        <SelectGroup>
                            <SelectLabel>THEMES</SelectLabel>
                            {THEMES.map((theme) => (
                                <SelectItem key={theme.name} value={theme.value}>
                                    {theme.name}
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    )}
                </SelectContent>
            </Select>
        </div>
    );
}

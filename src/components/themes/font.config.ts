import {
    Architects_Daughter,
    DM_Sans,
    Fira_Code,
    Geist,
    Geist_Mono,
    Instrument_Sans,
    Inter,
    Mulish,
    Noto_Sans_Mono,
    Outfit,
    Space_Mono,
} from "next/font/google";

import { cn } from "@/lib/utils";

/*
 * Only the default theme's fonts (`meridian` in `theme.config.ts`: Inter and Geist Mono) are
 * preloaded on every page. The other themes' fonts download when a theme using them is chosen;
 * update `preload` here if the default theme changes.
 */
const fontSans = Geist({
    preload: false,
    subsets: ["latin"],
    variable: "--font-sans",
});

const fontMono = Geist_Mono({
    subsets: ["latin"],
    variable: "--font-mono",
});

const fontInstrument = Instrument_Sans({
    preload: false,
    subsets: ["latin"],
    variable: "--font-instrument",
});

const fontNotoMono = Noto_Sans_Mono({
    preload: false,
    subsets: ["latin"],
    variable: "--font-noto-mono",
});

const fontMullish = Mulish({
    preload: false,
    subsets: ["latin"],
    variable: "--font-mullish",
});

const fontInter = Inter({
    subsets: ["latin"],
    variable: "--font-inter",
});

const fontArchitectsDaughter = Architects_Daughter({
    preload: false,
    subsets: ["latin"],
    variable: "--font-architects-daughter",
    weight: "400",
});

const fontDMSans = DM_Sans({
    preload: false,
    subsets: ["latin"],
    variable: "--font-dm-sans",
});

const fontFiraCode = Fira_Code({
    preload: false,
    subsets: ["latin"],
    variable: "--font-fira-code",
});

const fontOutfit = Outfit({
    preload: false,
    subsets: ["latin"],
    variable: "--font-outfit",
});

const fontSpaceMono = Space_Mono({
    preload: false,
    subsets: ["latin"],
    variable: "--font-space-mono",
    weight: ["400", "700"],
});

export const fontVariables = cn(
    fontSans.variable,
    fontMono.variable,
    fontInstrument.variable,
    fontNotoMono.variable,
    fontMullish.variable,
    fontInter.variable,
    fontArchitectsDaughter.variable,
    fontDMSans.variable,
    fontFiraCode.variable,
    fontOutfit.variable,
    fontSpaceMono.variable
);

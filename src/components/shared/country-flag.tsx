import { cn } from "@/lib/utils";

const FLAG_SIZES = {
    lg: { height: 24, width: 32 },
    md: { height: 15, width: 20 },
    sm: { height: 12, width: 16 },
    xl: { height: 36, width: 48 },
} as const;

interface CountryFlagProps {
    /** ISO 3166-1 alpha-2 code. A neutral placeholder is shown when it is missing. */
    alpha2: string | null | undefined;
    className?: string;
    /** Accessible name. Omit when the country name is already rendered next to the flag. */
    label?: string;
    size?: keyof typeof FLAG_SIZES;
}

/**
 * Rectangular country flag rendered from the `flag-icons` SVG set. Sizing is applied inline
 * because the library's unlayered CSS would otherwise override Tailwind utilities.
 */
export function CountryFlag({ alpha2, label, size = "md", className }: CountryFlagProps) {
    const dimensions = FLAG_SIZES[size];
    const style = {
        backgroundSize: "cover",
        height: dimensions.height,
        lineHeight: `${dimensions.height}px`,
        width: dimensions.width,
    };

    const accessibility = label
        ? ({ "aria-label": label, role: "img" } as const)
        : ({ "aria-hidden": true } as const);

    return (
        <span
            className={cn(
                "inline-block shrink-0 overflow-hidden rounded-[2px] bg-muted shadow-[0_0_0_1px_var(--border)]",
                alpha2 && `fi fi-${alpha2.toLowerCase()}`,
                className
            )}
            style={style}
            {...accessibility}
        />
    );
}

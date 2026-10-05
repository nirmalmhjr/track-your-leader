import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility function for conditionally joining and merging Tailwind CSS classes.
 *
 * Combines:
 * - `clsx` → Handles conditional class concatenation
 * - `tailwind-merge` → Resolves Tailwind class conflicts intelligently
 *
 * Why this exists:
 * When dynamically composing class names in React components,
 * conflicting Tailwind utilities (e.g., `px-2` and `px-4`)
 * can cause unexpected styling. `twMerge` ensures the
 * latter class properly overrides the former.
 *
 * Example:
 * ```ts
 * cn("px-2", isActive && "px-4")
 * ```
 * Result:
 * ```
 * "px-4"
 * ```
 *
 * @param inputs - Any number of class values (strings, arrays, objects, conditionals)
 * @returns A merged, conflict-free Tailwind class string
 */
export function cn(...inputs: ClassValue[]): string {
    return twMerge(clsx(inputs));
}

export const NAME_SPLIT_REGEX = /\s+/;

/**
 * Returns the initials of a name.
 *
 * @param name - The name to get the initials of
 * @returns The initials of the name
 */
export function getInitials(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) return "NA";

    const parts = trimmed.split(NAME_SPLIT_REGEX).filter(Boolean);
    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
    }

    return `${parts[0][0]}${parts.at(-1)?.[0] ?? ""}`.toUpperCase();
}

const DIACRITICS_PATTERN = /\p{Diacritic}/gu;

/**
 * Normalises text for accent- and case-insensitive matching.
 *
 * @param value - Raw text.
 * @returns Lower-cased text without diacritics.
 */
export const normalizeSearchText = (value: string): string =>
    value.normalize("NFD").replace(DIACRITICS_PATTERN, "").toLowerCase().trim();

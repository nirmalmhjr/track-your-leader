/**
 * Deterministic Nepali formatting. Browsers such as Chrome ship no Nepali locale data for
 * `Intl`, so relying on it would render different text on the server and in the browser.
 */

const DEVANAGARI_DIGITS = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"] as const;
const ASCII_DIGIT_PATTERN = /\d/g;
const EN_NUMBER_FORMAT = new Intl.NumberFormat("en-US");

/** Gregorian month names in Nepali, January first (Unicode CLDR). */
export const NEPALI_MONTH_NAMES = [
    "जनवरी",
    "फेब्रुअरी",
    "मार्च",
    "अप्रिल",
    "मे",
    "जुन",
    "जुलाई",
    "अगस्ट",
    "सेप्टेम्बर",
    "अक्टोबर",
    "नोभेम्बर",
    "डिसेम्बर",
] as const;

/**
 * Replaces ASCII digits with Devanagari digits.
 *
 * @param value - Text containing ASCII digits.
 * @returns The same text with every digit in Devanagari.
 */
export const toDevanagariDigits = (value: string): string =>
    value.replace(ASCII_DIGIT_PATTERN, (digit) => DEVANAGARI_DIGITS[Number(digit)]);

/**
 * Formats a number with grouping separators and Devanagari digits.
 *
 * @param value - Number to format.
 * @returns Nepali-formatted number.
 */
export const formatNepaliNumber = (value: number): string =>
    toDevanagariDigits(EN_NUMBER_FORMAT.format(value));

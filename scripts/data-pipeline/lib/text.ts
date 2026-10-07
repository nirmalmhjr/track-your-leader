import anyAscii from "any-ascii";

const DIACRITICS = /[̀-ͯ]/g;
/** Anything but letters and digits, in any script. */
const NON_LETTER_OR_DIGIT = /[^\p{L}\p{N}]+/gu;
const NON_ASCII_ALPHANUMERIC = /[^a-z0-9]+/g;
const WHITESPACE = /\s+/g;
const FOOTNOTE_MARKERS = /\[(?:\d+|[a-z]|note \d+|citation needed)\]/gi;
const UPPERCASE_RUN = /(\p{Lu})(\p{Lu}+)/gu;
const ROMAN_NUMERAL = /^(?:I{1,3}|IV|V|VI{1,3}|IX|X)$/;
const SENTENCE_END = /(?<=[.!?])\s+(?=[A-Z"“(])/;
const PARENTHETICAL = /\s*\([^)]*\)\s*/g;

/**
 * Collapses whitespace and strips Wikipedia footnote markers such as `[12]`.
 *
 * @param value - Raw text.
 * @returns Clean single-line text.
 */
export const cleanText = (value: string): string =>
    value.replace(FOOTNOTE_MARKERS, "").replace(WHITESPACE, " ").trim();

/**
 * Normalises a name for comparison: no accents, punctuation or case. Letters of every script
 * are kept, so Persian or Korean names compare too.
 *
 * @param value - Name as written in a source.
 * @returns Lowercase words separated by single spaces.
 */
export const normalizeName = (value: string): string =>
    value
        .normalize("NFD")
        .replace(DIACRITICS, "")
        // Recompose what isn't an accent, such as Hangul syllables.
        .normalize("NFC")
        .toLowerCase()
        .replace(NON_LETTER_OR_DIGIT, " ")
        .trim();

/**
 * Removes a trailing parenthetical, as in Wikipedia titles like "John Smith (politician)".
 *
 * @param value - Title or name.
 * @returns The value without parenthetical qualifiers.
 */
export const stripParenthetical = (value: string): string =>
    value.replace(PARENTHETICAL, " ").trim();

/**
 * Checks whether two spellings refer to the same name. Word order is ignored (East Asian names
 * are often listed family name first) and a missing middle name is tolerated.
 *
 * @param a - First spelling.
 * @param b - Second spelling.
 * @returns `true` when the names match.
 */
export const isSameName = (a: string, b: string): boolean => {
    const left = new Set(normalizeName(a).split(" ").filter(Boolean));
    const right = new Set(normalizeName(b).split(" ").filter(Boolean));
    const [smaller, larger] = left.size <= right.size ? [left, right] : [right, left];
    if (smaller.size === 0) {
        return false;
    }
    const shared = [...smaller].filter((token) => larger.has(token)).length;
    const minimumShared = 2;
    return shared === smaller.size && (smaller.size >= minimumShared || larger.size === 1);
};

/**
 * Makes a URL-safe identifier from the Latin letters and digits of a text.
 *
 * @param value - Text to convert.
 * @returns Lowercase words joined by hyphens; empty for names in other scripts only.
 */
export const slugify = (value: string): string =>
    normalizeName(value).replace(NON_ASCII_ALPHANUMERIC, " ").trim().replaceAll(" ", "-");

/**
 * Converts the CIA's capitalised family names ("Balendra SHAH", "Pat McFADDEN") to normal
 * case, keeping initials and regnal numbers ("CHARLES III" becomes "Charles III").
 *
 * @param value - Name as published by the CIA.
 * @returns The name in title case.
 */
export const formatCiaName = (value: string): string =>
    value
        .split(WHITESPACE)
        .filter(Boolean)
        .map((word) =>
            ROMAN_NUMERAL.test(word)
                ? word
                : word.replace(
                      UPPERCASE_RUN,
                      (_match, first: string, rest: string) => `${first}${rest.toLowerCase()}`
                  )
        )
        .join(" ");

/**
 * Splits prose into sentences.
 *
 * @param value - Paragraph text.
 * @returns The sentences, trimmed.
 */
export const splitSentences = (value: string): string[] =>
    cleanText(value)
        .split(SENTENCE_END)
        .map((sentence) => sentence.trim())
        .filter(Boolean);

/**
 * Upper-cases the first letter.
 *
 * @param value - Text to adjust.
 * @returns The text with a capital first letter.
 */
export const capitalize = (value: string): string =>
    value ? `${value[0].toUpperCase()}${value.slice(1)}` : value;

/** Names written in Latin letters only (accents and the ʻokina allowed). */
const LATIN_NAME = /^[\p{Script=Latin}\p{M}\p{N}\s.,'’ʻ()&/-]+$/u;
/**
 * Scripts that transliterate reliably letter by letter. Arabic and Hebrew omit vowels, Thai and
 * Chinese don't separate words, and Devanagari's inherent vowels get lost, so those stay as written.
 */
const RELIABLE_SCRIPT =
    /^[\p{Script=Cyrillic}\p{Script=Greek}\p{Script=Georgian}\p{Script=Armenian}\p{Script=Hangul}\p{Script=Katakana}\p{Script=Hiragana}\p{M}\s.,'’()-]+$/u;

/**
 * Whether a name is written in Latin letters.
 *
 * @param name - Name in any script.
 * @returns `true` for "Bilen Saliu", `false` for "Билен Салиу".
 */
export const isLatinName = (name: string): boolean => LATIN_NAME.test(name);

/**
 * A name in Latin letters for the English app: transliterated from scripts that convert reliably
 * ("Билен Салиу" → "Bilen Saliu"), otherwise as written.
 *
 * @param name - Name in any script.
 * @returns The name to show, and the original when it was transliterated.
 */
export const toLatinName = (name: string): { name: string; original: string | null } =>
    isLatinName(name) || !RELIABLE_SCRIPT.test(name)
        ? { name, original: null }
        : { name: anyAscii(name), original: name };

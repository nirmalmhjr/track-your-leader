import type { CountryCode } from "@/types/geo.types";
import type { Portfolio, RoleCategory } from "@/types/travel.types";

import { cleanText } from "../lib/text";
import type { TravellerHint } from "../types";
import { countryCodeOfName } from "./places.resolve";
import { classifyTitle } from "./roles";

/**
 * Reads who a host's record names: "H.E. Mr. Girija Prasad Koirala, Prime Minister of Nepal",
 * "His Majesty The King of Bhutan", "President of Egypt Abdel Fattah el-Sisi", "Australian
 * Foreign Minister". Shared by the hosts' visit lists (India's MEA, the Kremlin): the office
 * and country identify the traveller, and the name, when given, confirms them.
 */

export type Office = Pick<TravellerHint, "categories" | "portfolio" | "title">;

/** Offices recognised in headlines, checked in order ("Vice President" before "President"). */
export const OFFICES: readonly (readonly [RegExp, Office])[] = [
    [
        /\bvice[- ]president/i,
        { categories: ["deputy_leader"], portfolio: null, title: "Vice President" },
    ],
    [
        /\b(?:(?:first )?deputy prime minister|vice premier)/i,
        { categories: ["deputy_leader"], portfolio: null, title: "Deputy Prime Minister" },
    ],
    [
        /\b(?:prime minister|pm\b|premier|chancellor|taoiseach)/i,
        { categories: ["head_of_government"], portfolio: null, title: "Prime Minister" },
    ],
    [
        // "Secretary of State" alone is the US foreign minister; "for Defence" is another ministry.
        /\b(?:foreign (?:minister|secretary)|external affairs minister|eam\b|foreign affairs|secretary of state\b(?!\s+for\s+(?!foreign)))/i,
        {
            categories: ["minister"],
            portfolio: "foreign_affairs",
            title: "Minister of Foreign Affairs",
        },
    ],
    // Crown princes and governors-general aren't heads of state; "Prince" rules only in a
    // principality, so it is read from the country below.
    [/\b(?:crown prince|governor[- ]general)/i, { categories: [], portfolio: null, title: null }],
    [
        /\b(?:president|king|queen|emperor|empress|emir|amir|sultan|grand duke|grand duchess)\b/i,
        { categories: ["head_of_state"], portfolio: null, title: "Head of state" },
    ],
];
const PRINCE = /\bprince\b/i;
const PRINCIPALITIES: ReadonlySet<CountryCode> = new Set(["LIE", "MCO"]);
const MINISTER = /\bminister\b/i;
/** Deputy and junior ministers, left out: their names are rarely known elsewhere. */
/** Someone acting for a leader ("US President's Special Envoy"), not the leader. */
const ON_BEHALF =
    /\b(?:envoy|representative|adviser|advisor|aide|assistant|ambassador|chief of staff|spokes(?:person|man|woman)|delegation)\b|['’]s\b/i;
const JUNIOR =
    /\b(?:deputy|vice|assistant|under)[- ](?:foreign )?(?:minister|secretary)\b|\b(?:minister of state|state minister)\b/i;
/** "French President", "German Chancellor": countries named by adjective. */
const DEMONYMS: Readonly<Record<string, CountryCode>> = {
    afghan: "AFG",
    american: "USA",
    argentine: "ARG",
    australian: "AUS",
    austrian: "AUT",
    bangladeshi: "BGD",
    belgian: "BEL",
    bhutanese: "BTN",
    brazilian: "BRA",
    british: "GBR",
    canadian: "CAN",
    chinese: "CHN",
    danish: "DNK",
    dutch: "NLD",
    egyptian: "EGY",
    emirati: "ARE",
    finnish: "FIN",
    french: "FRA",
    german: "DEU",
    greek: "GRC",
    indonesian: "IDN",
    iranian: "IRN",
    irish: "IRL",
    israeli: "ISR",
    italian: "ITA",
    japanese: "JPN",
    malaysian: "MYS",
    maldivian: "MDV",
    mexican: "MEX",
    nepalese: "NPL",
    nepali: "NPL",
    norwegian: "NOR",
    pakistani: "PAK",
    polish: "POL",
    portuguese: "PRT",
    russian: "RUS",
    saudi: "SAU",
    singaporean: "SGP",
    spanish: "ESP",
    swedish: "SWE",
    swiss: "CHE",
    thai: "THA",
    turkish: "TUR",
    vietnamese: "VNM",
};
const MAX_COUNTRY_WORDS = 3;
const HONORIFICS =
    /\b(?:his|her|their) (?:majesty|majesties|excellency|highness|royal highness)\b|\b(?:h\.?\s?m|h\.?\s?e|h\.?\s?r\.?\s?h|mr|mrs|ms|dr|shri|smt|lyonchen|lyonpo|sheikh|the)\b\.?/gi;
const NAME = /^[A-Z][\p{L}.'’-]+(?:\s+[A-Z][\p{L}.'’-]*){1,5}$/u;
const MAX_NAME_WORDS = 6;
const WHITESPACE = /\s+/;
const PUNCTUATION = /[,.()]/g;
const TRAILING_PUNCTUATION = /[,.]+$/;
const EDGE_COMMAS = /^[\s,]+|[\s,]+$/g;
/** "H.E. Mr. X, the Prime Minister of Y": a name, then the office. */
const COMMA_BEFORE_OFFICE = /,\s*(?=(?:the\s+)?[A-Z])/;
/**
 * The country named after an "of" in a phrase ("Amir of the State of Kuwait"), and what follows
 * it ("Prime Minister of Bhutan Jigmi Y. Thinley" leaves "Jigmi Y. Thinley").
 */
export const countryAfterOf = (phrase: string): { code: CountryCode; rest: string } | null => {
    const words = phrase.split(WHITESPACE);
    for (let start = 0; start < words.length; start += 1) {
        if (words[start]?.toLowerCase() !== "of") {
            continue;
        }
        for (let end = words.length; end > start + 1; end -= 1) {
            const name = words
                .slice(start + 1, end)
                .join(" ")
                .replace(TRAILING_PUNCTUATION, "");
            const code = countryCodeOfName(name);
            if (code) {
                return { code, rest: words.slice(end).join(" ") };
            }
        }
    }
    return null;
};

/**
 * A country named without "of": "United States Secretary of State", "Australian Foreign
 * Minister". The first country or adjective found, the host left out.
 */
export const countryInWords = (phrase: string, host: CountryCode): CountryCode | null => {
    const words = phrase.replace(PUNCTUATION, " ").split(WHITESPACE).filter(Boolean);
    for (let start = 0; start < words.length; start += 1) {
        const demonym = DEMONYMS[words[start]?.toLowerCase() ?? ""];
        if (demonym && demonym !== host) {
            return demonym;
        }
        for (let size = MAX_COUNTRY_WORDS; size > 0; size -= 1) {
            const code = countryCodeOfName(words.slice(start, start + size).join(" "));
            if (code && code !== host) {
                return code;
            }
        }
    }
    return null;
};

/** A personal name with titles taken off, or `null` when the text isn't one. */
export const nameOf = (text: string): string | null => {
    const stripped = cleanText(text.replace(HONORIFICS, " ").replace(EDGE_COMMAS, ""));
    return NAME.test(stripped) && stripped.split(" ").length <= MAX_NAME_WORDS ? stripped : null;
};

/** The office a phrase names, with its portfolio for ministers. */
export const officeOf = (phrase: string, code: CountryCode): Office | null => {
    if (JUNIOR.test(phrase) || ON_BEHALF.test(phrase)) {
        return null;
    }
    const known = OFFICES.find(([pattern]) => pattern.test(phrase))?.[1];
    if (known) {
        return known.categories.length > 0 ? known : null;
    }
    if (PRINCE.test(phrase) && PRINCIPALITIES.has(code)) {
        return { categories: ["head_of_state"], portfolio: null, title: "Prince" };
    }
    if (MINISTER.test(phrase)) {
        const role = classifyTitle(phrase);
        const [category] = role.categories;
        const isMinister = category === "minister" || category === "junior_minister";
        return isMinister
            ? {
                  categories: role.categories as RoleCategory[],
                  portfolio: role.portfolio as Portfolio | null,
                  title: "Minister",
              }
            : null;
    }
    return null;
};

export interface Visitor {
    code: CountryCode;
    name: string | null;
    office: Office;
}

/**
 * The visitor a phrase names, from a host's record.
 *
 * @param phrase - The part naming the visitor ("King of Bhutan", "H.E. Mr. X, President of Y").
 * @param host - The host country, never the visitor's.
 * @returns The visitor, or why none was found.
 */
export const readVisitor = (
    phrase: string,
    host: CountryCode
): Visitor | { reason: "office not recognised" | "visiting country not found" } => {
    const named = countryAfterOf(phrase);
    const country = named && named.code !== host ? named : null;
    const code = country?.code ?? countryInWords(phrase, host);
    if (!code) {
        return { reason: "visiting country not found" };
    }
    const office = officeOf(phrase, code);
    if (!office) {
        return { reason: "office not recognised" };
    }
    const [beforeComma, afterComma] = phrase.split(COMMA_BEFORE_OFFICE);
    const commaName =
        afterComma && OFFICES.some(([pattern]) => pattern.test(afterComma))
            ? nameOf(beforeComma ?? "")
            : null;
    return { code, name: commaName ?? nameOf(country?.rest ?? ""), office };
};

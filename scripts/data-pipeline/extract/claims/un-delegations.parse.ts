import type { CountryCode } from "@/types/geo.types";
import type { Portfolio, RoleCategory } from "@/types/travel.types";

import { cleanText, stripParenthetical } from "../../lib/text";
import { countryCodeOfName } from "../places.resolve";
import { classifyTitle } from "../roles";

/**
 * Reads the "list of delegates and other participants" that UN bodies publish for their
 * assemblies (the World Health Assembly, the International Labour Conference…). Every list has
 * the same shape, in English and French:
 *
 *     NEPAL - NEPAL
 *     Chief delegate - Chef de délégation
 *     Mr G. Pokharel
 *     Minister of Health and Population
 *     Delegate(s) - Délégué(s)
 *     Dr N.M. Shrestha
 *     Chief Specialist, Ministry of Health and Population
 *
 * Only members of government are kept: ministers, their deputies and leaders. Delegates are
 * named by initials and family name, so they are matched to officials by family name and office.
 */

export interface Delegate {
    categories: RoleCategory[];
    countryCode: CountryCode;
    familyName: string;
    portfolio: Portfolio | null;
    title: string;
}

const PAGE_NUMBER = /^-\s*\d+\s*-$/;
/** "Chief delegate - Chef de délégation", "Délégué(s) - Delegate(s)", "Adviser(s)"… */
const ROLE_HEADING =
    /^(chief delegate|deputy chief delegate|chef (adjoint )?de (la )?délégation|delegate|délégué|alternate|suppléant|adviser|advisor|conseiller|other|autre|representative|représentant)/i;
/** Headings of the parts after the member states (observers, the UN system, NGOs). */
const END_OF_MEMBERS =
    /^(observers?|observateurs?|representatives of the united nations|représentants de l'organisation des nations unies|intergovernmental organizations|non-state actors)\b/i;
/** A country heading: capitals, with the English and French names on either side of a dash. */
const COUNTRY_HEADING = /^[A-ZÀ-ÖØ-Ý' ,.()-]{3,}$/;
const HEADING_SEPARATOR = /\s+-\s+|\s*–\s*/;
const HONORIFIC =
    /^(?:H\.?\s?E\.?|S\.?\s?E\.?|Mr|Mrs|Ms|Miss|Mme|Mlle|M|Dr|Dra|Prof|Professor|Professeur|Sr|Sra|Srta|Sir|Dame|Lord|Baroness|Hon|Sheikh|Sheikha|Prince|Princess|HRH|Excmo|Excma)\.?$/i;
/** "S.S.", "K.R.", "A.-M.": initials before a family name. */
const INITIALS = /^(?:\p{Lu}\.[-‐]?)+$/u;
const PERSON_LINE =
    /^(?:(?:H\.?\s?E\.?|Mr|Mrs|Ms|Miss|Mme|Mlle|M|Dr|Dra|Prof|Professor|Professeur|Sr|Sra|Srta|Sir|Dame|Hon|Sheikh|Sheikha|Prince|Princess)\.?\s+)+(?:\p{Lu}\.[-‐]?\s?)*\p{L}/u;
/** French, Spanish and Portuguese ministerial titles, which `classifyTitle` (English) misses. */
const FOREIGN_JUNIOR_MINISTER =
    /^(vice-?ministre|viceministr[oa]|vice-ministr[oa]|secrétaire d'état|secretari[oa] de estado|ministre délégué|ministro de estado)/i;
const FOREIGN_MINISTER = /^(ministre|ministr[oa])\b/i;
/** "Cabinet Secretary for Health", "Secretary of Health"; not "Secretary, Ministry of Health". */
const CABINET_SECRETARY =
    /^(cabinet secretary\b|secretary (of|for) (state for )?(public )?health\b)/i;
/**
 * Not members of government: diplomats ranked "Minister" ("Minister Counsellor, Permanent
 * Mission, Geneva") and academics ("Vice Chancellor, … University").
 */
const NOT_GOVERNMENT =
    /mission|permanent|embassy|ambassade|embajada|counsellor|counselor|conseiller|consejer[oa]|conselheir[oa]|plenipotentiary|pl[ée]nipotentiaire|plenipotenciari[oa]|universit|college|institute/i;
const HEALTH = /health|santé|sante|salud|saúde|sanidad|sanitaire/i;
const LABOUR = /labou?r|travail|trabajo|emploi|empleo|employment/i;
const HYPHENATED_BREAK = /-\s+(?=\p{Ll})/gu;
const WHITESPACE = /\s+/;

/** Roles kept: members of government only. */
const GOVERNMENT_ROLES: ReadonlySet<RoleCategory> = new Set([
    "head_of_state",
    "head_of_government",
    "deputy_leader",
    "minister",
    "junior_minister",
]);

const countryOfHeading = (line: string): CountryCode | null => {
    if (!(COUNTRY_HEADING.test(line) && HEADING_SEPARATOR.test(line))) {
        return null;
    }
    for (const part of line.split(HEADING_SEPARATOR)) {
        const code = countryCodeOfName(stripParenthetical(part));
        if (code) {
            return code;
        }
    }
    return null;
};

/** "Mr S.S. Bhandari" → "Bhandari"; "Sra. C. Sánchez Reyes" → "Sánchez Reyes". */
export const familyNameOf = (line: string): string =>
    line
        .split(WHITESPACE)
        .filter((token) => !(HONORIFIC.test(token) || INITIALS.test(token)))
        .join(" ");

/** Role of a delegate's title, in any of the languages lists use; `null` outside government. */
export const governmentRole = (
    title: string
): { categories: RoleCategory[]; portfolio: Portfolio | null } | null => {
    if (NOT_GOVERNMENT.test(title)) {
        return null;
    }
    const portfolioFromWords = (): Portfolio | null => {
        if (HEALTH.test(title)) {
            return "health";
        }
        return LABOUR.test(title) ? "labour" : null;
    };
    if (FOREIGN_JUNIOR_MINISTER.test(title)) {
        return { categories: ["junior_minister"], portfolio: portfolioFromWords() };
    }
    if (FOREIGN_MINISTER.test(title) || CABINET_SECRETARY.test(title)) {
        return { categories: ["minister"], portfolio: portfolioFromWords() };
    }
    const role = classifyTitle(title);
    if (!role.categories.some((category) => GOVERNMENT_ROLES.has(category))) {
        return null;
    }
    return { categories: role.categories, portfolio: role.portfolio ?? portfolioFromWords() };
};

/**
 * Reads the members of government in a delegation list.
 *
 * @param lines - The document's text, one line per entry.
 * @returns Every minister, deputy minister and leader listed, with their country.
 */
export const parseDelegations = (lines: readonly string[]): Delegate[] => {
    const delegates: Delegate[] = [];
    let country: CountryCode | null = null;
    let person: string | null = null;
    let title: string[] = [];

    const flush = () => {
        if (country && person && title.length > 0) {
            const text = cleanText(title.join(" ").replace(HYPHENATED_BREAK, ""));
            const role = governmentRole(text);
            const familyName = familyNameOf(person);
            if (role && familyName) {
                delegates.push({ ...role, countryCode: country, familyName, title: text });
            }
        }
        person = null;
        title = [];
    };

    for (const raw of lines) {
        const line = cleanText(raw);
        if (!line || PAGE_NUMBER.test(line)) {
            continue;
        }
        if (END_OF_MEMBERS.test(line)) {
            flush();
            break;
        }
        const heading = countryOfHeading(line);
        if (heading) {
            flush();
            country = heading;
        } else if (ROLE_HEADING.test(line)) {
            flush();
        } else if (PERSON_LINE.test(line)) {
            flush();
            person = line;
        } else if (person) {
            title.push(line);
        }
    }
    flush();
    return delegates;
};

import type { TravelType } from "@/features/travel-explorer/types/travel.types";

/**
 * Infers a trip's type from the purpose written in the source ("State visit", "G20 summit",
 * "Official visit; bilateral talks with…"). The first matching rule wins, so specific types
 * come before general ones.
 */

const TYPE_RULES: readonly (readonly [RegExp, TravelType])[] = [
    [/\bstate visit\b/i, "state_visit"],
    [
        /\bsummit\b|\bg-?7\b|\bg-?20\b|\bchogm\b|\bapec\b|\bleaders'? (meeting|week)\b|\bheads of (state|government)\b/i,
        "summit",
    ],
    [
        /\bconference\b|\bforum\b|\bcop ?\d+\b|\bgeneral assembly\b|\bcongress\b|\bsymposium\b|\bexpo\b|\bolympic|\bworld economic\b|\bdavos\b/i,
        "conference",
    ],
    [/\bmultilateral\b|\bministerial (meeting|council)\b|\bfriends of\b/i, "multilateral_meeting"],
    [/\bbilateral\b/i, "bilateral_meeting"],
    [/\b(official|working|official working) visit\b|\bofficial trip\b/i, "official_visit"],
    [
        /\bdiplomatic\b|\bconsultations?\b|\btalks\b|\b(meet|meets|meeting|met) with\b/i,
        "diplomatic_visit",
    ],
];

/** Phrases that name a specific event worth showing as the trip's title. */
const EVENT_NAME =
    /\b(summit|conference|forum|assembly|cop ?\d+|g-?7|g-?20|games|olympics|expo|inauguration|funeral|coronation|ceremony|meeting|congress|session)\b/i;
const MAX_EVENT_NAME_LENGTH = 90;
const LEADING_VISIT_TYPE = /^(?:state|official|working|official working) visit\b/i;

/**
 * Classifies a trip.
 *
 * @param texts - Purpose first, then notes; earlier texts take priority.
 * @returns The travel type, `other` when nothing matches.
 */
export const classifyTripType = (...texts: readonly (string | null)[]): TravelType => {
    for (const text of texts) {
        const match = text ? TYPE_RULES.find(([pattern]) => pattern.test(text)) : undefined;
        if (match) {
            return match[1];
        }
    }
    return "other";
};

/**
 * Picks an event name from the purpose cell: a linked article about an event ("6th BRICS
 * summit") or, failing that, a short purpose that names one.
 *
 * @param linkTexts - Texts of the links in the purpose cell.
 * @param purpose - Purpose text.
 * @returns The event name, or `null` for plain visits.
 */
export const detectEventName = (linkTexts: readonly string[], purpose: string): string | null => {
    const linked = linkTexts.find(
        (text) => EVENT_NAME.test(text) && text.length <= MAX_EVENT_NAME_LENGTH
    );
    if (linked) {
        return linked;
    }
    const isShortEvent =
        purpose.length <= MAX_EVENT_NAME_LENGTH &&
        EVENT_NAME.test(purpose) &&
        !LEADING_VISIT_TYPE.test(purpose);
    return isShortEvent ? purpose : null;
};

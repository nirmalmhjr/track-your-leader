import { z } from "zod";

import type { IsoDate } from "@/features/travel-explorer/types/travel.types";
import type { CountryCode } from "@/types/geo.types";

import { isSameName, normalizeName } from "../lib/text";
import type { CabinetResult } from "./cabinets.extract";

/**
 * The roster is the pipeline's memory of cabinet members. The CIA list only says who holds an
 * office today, so tenure is tracked across daily runs: the day someone first appears becomes
 * their start date, and the day they disappear becomes their end date. People already in
 * office on the first run get an unknown start date rather than a made-up one.
 *
 * Only changes are written (no "last seen" stamps), so quiet days produce no git commits.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const rosterTermSchema = z.object({
    endedOn: isoDate.nullable(),
    since: isoDate.nullable(),
});

const rosterMemberSchema = z.object({
    countryCode: z.string(),
    /** When Wikidata was last searched for this person (retried after a while if unmatched). */
    lookedUpOn: isoDate.nullable(),
    name: z.string(),
    /** Terms keyed by expanded office title. */
    positions: z.record(z.string(), rosterTermSchema),
    wikidataId: z.string().nullable(),
});

export const rosterSchema = z.record(z.string(), rosterMemberSchema);

export type Roster = z.infer<typeof rosterSchema>;
export type RosterMember = z.infer<typeof rosterMemberSchema>;

/**
 * Key of a roster entry.
 *
 * @param code - Country code.
 * @param name - Person's name.
 * @returns `NPL:balendra shah`-style key.
 */
export const rosterKey = (code: CountryCode, name: string): string =>
    `${code}:${normalizeName(name)}`;

const findKey = (roster: Roster, code: CountryCode, name: string): string => {
    const exact = rosterKey(code, name);
    if (roster[exact]) {
        return exact;
    }
    // Spelling changes between CIA updates ("Ram Sahaya Prasad Yadav" vs "Ram Sahaya Yadav").
    const similar = Object.entries(roster).find(
        ([, member]) => member.countryCode === code && isSameName(member.name, name)
    );
    return similar?.[0] ?? exact;
};

/** Ends every open term in a country that today's cabinet list no longer contains. */
const closeDepartedTerms = (
    roster: Roster,
    code: CountryCode,
    seen: ReadonlySet<string>,
    today: IsoDate
): void => {
    for (const [key, member] of Object.entries(roster)) {
        if (member.countryCode !== code) {
            continue;
        }
        for (const [title, term] of Object.entries(member.positions)) {
            if (term.endedOn === null && !seen.has(`${key}|${title}`)) {
                term.endedOn = today;
            }
        }
    }
};

/**
 * Applies today's cabinet list for one country to the roster.
 *
 * @param roster - Roster to update in place.
 * @param code - Country code.
 * @param cabinet - Today's cabinet; ignored unless its status is `ok`.
 * @param today - Run date.
 */
export const updateRoster = (
    roster: Roster,
    code: CountryCode,
    cabinet: CabinetResult,
    today: IsoDate
): void => {
    if (cabinet.status !== "ok") {
        return;
    }
    const isNewCountry = !Object.values(roster).some((member) => member.countryCode === code);
    const seen = new Set<string>();

    for (const person of cabinet.members) {
        const key = findKey(roster, code, person.name);
        const member: RosterMember = roster[key] ?? {
            countryCode: code,
            lookedUpOn: null,
            name: person.name,
            positions: {},
            wikidataId: null,
        };
        member.name = person.name;
        for (const title of person.titles) {
            const term = member.positions[title];
            if (!term || term.endedOn !== null) {
                member.positions[title] = { endedOn: null, since: isNewCountry ? null : today };
            }
            seen.add(`${key}|${title}`);
        }
        roster[key] = member;
    }

    closeDepartedTerms(roster, code, seen, today);
};

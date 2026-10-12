import {
    decodeOfficial,
    encodeOfficial,
    type OfficialRow,
} from "@/features/travel-explorer/data/travel-index";
import type { CountryCode } from "@/types/geo.types";
import type { RoleCategory } from "@/types/travel.types";

import { groupBy } from "../lib/collections";
import { normalizeName, stripParenthetical } from "../lib/text";
import type { OfficialDraft } from "../types";
import { assignIds, type IdRecord, storedPositions } from "./officials.extract";
import type { PersonDraft } from "./people.extract";

/**
 * Splits everyone politically exposed between the two places they are stored:
 *
 * - the country files (`public/data/countries/`), with biographies and sources, for officials
 *   the explorer shows: anyone with a trip, and the executive (heads of state and government,
 *   deputies, ministers);
 * - the people store (`data/warehouse/people/`), as compact rows, for everyone else.
 */

/** Roles whose holders always get a full record, travelled or not. */
const EXECUTIVE_ROLES: ReadonlySet<RoleCategory> = new Set([
    "head_of_state",
    "head_of_government",
    "governor_general",
    "deputy_leader",
    "minister",
    "junior_minister",
]);

const titleKey = (title: string): string => normalizeName(stripParenthetical(title));

/**
 * Folds people who are already officials (leaders, cabinet members) into those officials, adding
 * the offices only Wikidata's wider sweep found.
 *
 * @param drafts - Officials from the leaders and cabinets steps; updated in place.
 * @param people - Everyone politically exposed, keyed by Wikidata id.
 * @returns The people who aren't officials yet.
 */
export const mergePeople = (
    drafts: readonly OfficialDraft[],
    people: ReadonlyMap<string, PersonDraft>
): PersonDraft[] => {
    const merged = new Set<string>();
    for (const draft of drafts) {
        const person = draft.wikidataId ? people.get(draft.wikidataId) : undefined;
        if (!person) {
            continue;
        }
        const known = new Set(draft.positions.map((position) => titleKey(position.title)));
        draft.positions.push(
            ...person.positions.filter((position) => !known.has(titleKey(position.title)))
        );
        merged.add(person.wikidataId);
    }
    return [...people.values()].filter((person) => !merged.has(person.wikidataId));
};

/**
 * Whether someone gets a full record: they travelled, or they hold or held an executive office.
 *
 * @param person - Person to check.
 * @param travelled - People some trip was matched to.
 * @returns `true` to store them with the officials.
 */
export const isPromoted = (person: PersonDraft, travelled: ReadonlySet<OfficialDraft>): boolean =>
    travelled.has(person) ||
    person.positions.some((position) =>
        position.categories.some((category) => EXECUTIVE_ROLES.has(category))
    );

interface PeopleRowsInput {
    /** People with no full record. */
    people: readonly PersonDraft[];
    /** Everyone earlier runs named (officials and people), for stable ids. */
    previous: readonly IdRecord[];
    /** Ids taken by officials and by people of countries outside this run. */
    reserved: ReadonlySet<string>;
}

/**
 * Turns people into the people store's rows, grouped by country and sorted by name.
 *
 * @returns Rows per country code.
 */
export const buildPeopleRows = ({
    people,
    previous,
    reserved,
}: PeopleRowsInput): Map<CountryCode, OfficialRow[]> => {
    const ids = assignIds(people, previous, reserved);
    const rows = people.map((person) => {
        const id = ids.get(person) ?? person.wikidataId.toLowerCase();
        return {
            countryCode: person.countryCode,
            name: person.name,
            row: encodeOfficial({
                countryCode: person.countryCode,
                fullName: person.name,
                id,
                party: person.party,
                photoUrl: person.photoUrl,
                positions: storedPositions(person, id),
                wikidataId: person.wikidataId,
            }),
        };
    });
    rows.sort((a, b) => a.name.localeCompare(b.name) || a.row[0].localeCompare(b.row[0]));
    return new Map(
        [...groupBy(rows, (entry) => entry.countryCode)].map(([code, list]) => [
            code,
            list.map((entry) => entry.row),
        ])
    );
};

/**
 * What the people store says about earlier runs' people, for stable ids.
 *
 * @param stored - Rows per country.
 * @returns One record per person.
 */
export const idRecordsOf = (stored: ReadonlyMap<CountryCode, readonly OfficialRow[]>): IdRecord[] =>
    [...stored.values()].flat().map((row) => {
        const { countryCode, fullName, id, wikidataId } = decodeOfficial(row);
        return { countryCode, fullName, id, wikidataId };
    });

const nameKey = (countryCode: string, name: string): string =>
    `${countryCode}|${normalizeName(stripParenthetical(name))}`;

/**
 * Folds officials known only by name (a cabinet list's "Sirajuddin Haqqani", whom the Wikidata
 * search missed) into the one identified official or person of the same country with that name,
 * so nobody is listed twice. Two identified people sharing a name are left apart.
 *
 * @param officials - Officials; updated in place.
 * @param people - Everyone else politically exposed; updated in place.
 * @returns The officials without the twins that were folded in.
 */
export const mergeNameTwins = (
    officials: readonly OfficialDraft[],
    people: readonly OfficialDraft[]
): OfficialDraft[] => {
    const identified = new Map<string, OfficialDraft[]>();
    for (const record of [...officials, ...people]) {
        if (!record.wikidataId) {
            continue;
        }
        for (const key of new Set(
            [record.name, ...record.aliases].map((name) => nameKey(record.countryCode, name))
        )) {
            identified.set(key, [...(identified.get(key) ?? []), record]);
        }
    }
    return officials.filter((twin) => {
        if (twin.wikidataId) {
            return true;
        }
        const matches = [...new Set(identified.get(nameKey(twin.countryCode, twin.name)) ?? [])];
        const [target] = matches;
        if (matches.length !== 1 || !target) {
            return true;
        }
        target.positions.push(...twin.positions);
        target.sources.push(
            ...twin.sources.filter(
                (source) => !target.sources.some((known) => known.url === source.url)
            )
        );
        target.aliases.push(twin.name, ...twin.aliases);
        return false;
    });
};

import type {
    IsoDate,
    Official,
    Position,
    TrackedCountry,
    TravelDataset,
    TravelRecord,
    TravelType,
} from "@/features/travel-explorer/types/travel.types";
import {
    isPositionActiveOn,
    resolvePositionTitle,
} from "@/features/travel-explorer/utils/positions.utils";
import { resolveTravelStatus } from "@/features/travel-explorer/utils/travel-status.utils";
import { getCountryReference } from "@/lib/geo/country-reference";
import type { CountryCode } from "@/types/geo.types";

import { SAMPLE_CITIES } from "./cities.data";
import { SAMPLE_COUNTRY_SEEDS, type SampleCountrySeed } from "./countries.data";
import { type DelegateRole, SAMPLE_EVENTS, type SampleEventSeed } from "./events.data";
import { SAMPLE_OFFICIALS } from "./officials.data";
import { SAMPLE_VISITS, type SampleVisitSeed } from "./visits.data";

/** Lower values win when several officials could represent a country in the same role. */
const CATEGORY_PREFERENCE = ["minister", "deputy_leader", "senior_official"] as const;

const DEFAULT_ENGAGEMENTS: Readonly<Record<TravelType, (host: string) => readonly string[]>> = {
    bilateral_meeting: (host) => [`Bilateral talks with ${host} counterparts`],
    conference: () => ["Plenary address", "Panel discussions"],
    diplomatic_visit: (host) => [`Consultations with senior ${host} officials`],
    multilateral_meeting: () => ["Ministerial sessions", "Bilateral meetings on the sidelines"],
    official_visit: (host) => [
        `Delegation-level talks with the Government of ${host}`,
        "Joint press statement",
    ],
    other: () => [],
    state_visit: (host) => [
        "State welcome ceremony",
        `Talks with the head of state of ${host}`,
        "State banquet",
    ],
    summit: () => ["Leaders' plenary sessions", "Bilateral meetings on the sidelines"],
};

const preferenceOf = (position: Position): number => {
    const index = CATEGORY_PREFERENCE.findIndex((category) =>
        position.categories.includes(category)
    );
    return index === -1 ? CATEGORY_PREFERENCE.length : index;
};

const matchesRole = (position: Position, role: DelegateRole, country: SampleCountrySeed) => {
    switch (role) {
        case "leader":
            return position.categories.includes(country.summitLead);
        case "head_of_government":
            return position.categories.includes("head_of_government");
        case "deputy":
            return position.categories.includes("deputy_leader");
        default:
            return position.portfolio === role;
    }
};

const resolveDelegate = (
    officials: readonly Official[],
    country: SampleCountrySeed,
    role: DelegateRole,
    date: IsoDate
): Official | undefined => {
    const candidates = officials.flatMap((official) =>
        official.positions
            .filter(
                (position) =>
                    isPositionActiveOn(position, date) && matchesRole(position, role, country)
            )
            .map((position) => ({ official, preference: preferenceOf(position) }))
    );

    return candidates.sort((a, b) => a.preference - b.preference)[0]?.official;
};

interface RecordInput {
    country: TrackedCountry;
    id: string;
    official: Official;
    seed: Omit<SampleVisitSeed, "officialId">;
    today: IsoDate;
}

const createRecord = ({ id, official, country, seed, today }: RecordInput): TravelRecord => {
    const destination = SAMPLE_CITIES[seed.city];
    const hostName = getCountryReference(destination.countryCode)?.name ?? destination.city;

    return {
        datePrecision: "day",
        destination,
        endDate: seed.endDate,
        engagements: seed.engagements ?? DEFAULT_ENGAGEMENTS[seed.type](hostName),
        eventName: seed.eventName ?? null,
        id,
        officialId: official.id,
        origin: country.capital,
        originCountryCode: country.code,
        positionTitle: resolvePositionTitle(official, seed.startDate),
        purpose: seed.purpose,
        sources: [],
        startDate: seed.startDate,
        status: resolveTravelStatus({
            datePrecision: "day",
            endDate: seed.endDate,
            hint: seed.status ?? null,
            today,
        }),
        type: seed.type,
    };
};

const compareRecordsNewestFirst = (a: TravelRecord, b: TravelRecord): number =>
    b.startDate.localeCompare(a.startDate) || a.id.localeCompare(b.id);

interface DatasetIndex {
    countryByCode: ReadonlyMap<CountryCode, TrackedCountry>;
    officialById: ReadonlyMap<string, Official>;
    officialsByCountry: ReadonlyMap<CountryCode, readonly Official[]>;
    seedByCode: ReadonlyMap<CountryCode, SampleCountrySeed>;
}

const buildIndex = (countries: readonly TrackedCountry[]): DatasetIndex => {
    const officialsByCountry = new Map<CountryCode, Official[]>();
    for (const official of SAMPLE_OFFICIALS) {
        const list = officialsByCountry.get(official.countryCode);
        if (list) {
            list.push(official);
        } else {
            officialsByCountry.set(official.countryCode, [official]);
        }
    }

    return {
        countryByCode: new Map(countries.map((country) => [country.code, country])),
        officialById: new Map(SAMPLE_OFFICIALS.map((official) => [official.id, official])),
        officialsByCountry,
        seedByCode: new Map(SAMPLE_COUNTRY_SEEDS.map((seed) => [seed.code, seed])),
    };
};

/** Expands one multilateral event into a trip for every delegate who travelled to it. */
const buildEventRecords = (
    event: SampleEventSeed,
    index: DatasetIndex,
    today: IsoDate
): TravelRecord[] => {
    const hostCountry = SAMPLE_CITIES[event.city].countryCode;
    const delegations = Object.entries(event.delegations) as [
        DelegateRole,
        readonly CountryCode[],
    ][];

    return delegations.flatMap(([role, codes]) =>
        codes.flatMap((code) => {
            const seed = index.seedByCode.get(code);
            const country = index.countryByCode.get(code);
            if (!(seed && country) || code === hostCountry) {
                return [];
            }

            const official = resolveDelegate(
                index.officialsByCountry.get(code) ?? [],
                seed,
                role,
                event.startDate
            );
            if (!official) {
                return [];
            }

            return [
                createRecord({
                    country,
                    id: `${event.id}--${official.id}`,
                    official,
                    seed: {
                        city: event.city,
                        endDate: event.endDate,
                        engagements: event.engagements,
                        eventName: event.name,
                        purpose: `Attend the ${event.name}`,
                        startDate: event.startDate,
                        status: event.tentative ? "planned" : undefined,
                        type: event.type,
                    },
                    today,
                }),
            ];
        })
    );
};

const buildVisitRecord = (
    visit: SampleVisitSeed,
    index: DatasetIndex,
    today: IsoDate
): TravelRecord => {
    const official = index.officialById.get(visit.officialId);
    const country = official ? index.countryByCode.get(official.countryCode) : undefined;
    if (!(official && country)) {
        throw new Error(`Sample visit references unknown official "${visit.officialId}"`);
    }

    return createRecord({
        country,
        id: `${visit.officialId}--${visit.startDate}--${visit.city}`,
        official,
        seed: visit,
        today,
    });
};

/**
 * Builds the fictional sample dataset, used when no generated data is available. Statuses are
 * derived from `today`, exactly as they are for real data.
 *
 * @param today - Reference date for status calculation.
 * @returns Countries, officials and travel records ready for the explorer.
 */
export const buildSampleTravelDataset = (today: IsoDate): TravelDataset => {
    const countries: TrackedCountry[] = SAMPLE_COUNTRY_SEEDS.map((seed) => ({
        capital: SAMPLE_CITIES[seed.capital],
        code: seed.code,
        governmentSystem: seed.governmentSystem,
        name: seed.name,
    }));
    const index = buildIndex(countries);

    const records = new Map<string, TravelRecord>();
    for (const record of [
        ...SAMPLE_EVENTS.flatMap((event) => buildEventRecords(event, index, today)),
        ...SAMPLE_VISITS.map((visit) => buildVisitRecord(visit, index, today)),
    ]) {
        records.set(record.id, record);
    }

    return {
        countries,
        officials: SAMPLE_OFFICIALS,
        records: [...records.values()].sort(compareRecordsNewestFirst),
    };
};

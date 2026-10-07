import type { CountryCode } from "@/types/geo.types";
import type { IsoDate, RoleCategory } from "@/types/travel.types";

import { readCountries, type WarehouseOfficial, writeWarehouseFile } from "../lib/warehouse";

/**
 * The coverage report (`data/warehouse/coverage.json`): every year each head of state or
 * government spent in office, with the trips on record for it. Leaders rarely spend a whole
 * year without travelling, so a year with a handful of trips is most likely a gap in the
 * sources, not a quiet year. The report is the to-do list for new sources: which leaders and
 * which years to look for, recent ones first.
 */

const LEADER_ROLES: ReadonlySet<RoleCategory> = new Set(["head_of_state", "head_of_government"]);
/** A year with at most this many trips is reported as thin. */
export const THIN_YEAR_MAX_TRIPS = 2;
/** Years from this one on are checked first. */
export const RECENT_FROM_YEAR = 2015;
const EARLIEST_YEAR = 1945;
const MS_PER_DAY = 86_400_000;
/** A year counts once the leader held office for at least half of it (half so far, this year). */
const MIN_SHARE_OF_YEAR = 0.5;
/** This year counts only once this much of it has passed. */
const MIN_DAYS_INTO_YEAR = 60;

export interface LeaderYear {
    country: CountryCode;
    official: string;
    officialId: string;
    role: RoleCategory;
    title: string;
    trips: number;
    year: number;
}

interface Term {
    country: CountryCode;
    endDate: IsoDate | null;
    official: WarehouseOfficial;
    role: RoleCategory;
    startDate: IsoDate;
    title: string;
}

const dayNumber = (date: IsoDate): number => Date.parse(`${date}T00:00:00Z`) / MS_PER_DAY;

/**
 * Leader terms with a known end. Wikidata often leaves a term open after it ended, so an open
 * term ends when the next holder of the same office took over; only the latest holder's term is
 * still running.
 */
const leaderTerms = (country: CountryCode, officials: readonly WarehouseOfficial[]): Term[] => {
    const terms: Term[] = officials.flatMap((official) =>
        official.positions.flatMap((position) => {
            const [role] = position.categories;
            // Terms of unknown dates (`undated`) say nothing about any year.
            if (!(role && LEADER_ROLES.has(role) && position.startDate) || position.undated) {
                return [];
            }
            return [
                {
                    country,
                    endDate: position.endDate,
                    official,
                    role,
                    startDate: position.startDate,
                    title: position.title,
                },
            ];
        })
    );
    return terms.map((term) => {
        if (term.endDate) {
            return term;
        }
        const [successor] = terms
            .filter((other) => other.title === term.title && other.startDate > term.startDate)
            .sort((a, b) => a.startDate.localeCompare(b.startDate));
        return successor ? { ...term, endDate: successor.startDate } : term;
    });
};

/**
 * The years of a term the leader held office for at least half of (half so far, this year).
 *
 * @param term - The term, with its end inferred.
 * @param today - Today's date.
 * @returns The years, oldest first.
 */
const yearsHeld = (term: Term, today: IsoDate): number[] => {
    const currentYear = Number(today.slice(0, 4));
    const termStart = dayNumber(term.startDate);
    const termEnd = dayNumber(term.endDate ?? today);
    const firstYear = Math.max(Number(term.startDate.slice(0, 4)), EARLIEST_YEAR);
    const lastYear = Math.min(Number((term.endDate ?? today).slice(0, 4)), currentYear);
    const years: number[] = [];
    for (let year = firstYear; year <= lastYear; year += 1) {
        const yearStart = dayNumber(`${year}-01-01`);
        const yearEnd = dayNumber(year === currentYear ? today : `${year}-12-31`);
        const yearDays = yearEnd - yearStart + 1;
        const heldDays = Math.min(termEnd, yearEnd) - Math.max(termStart, yearStart) + 1;
        if (yearDays >= MIN_DAYS_INTO_YEAR && heldDays >= yearDays * MIN_SHARE_OF_YEAR) {
            years.push(year);
        }
    }
    return years;
};

/**
 * Every year each leader held office for at least half of, with their trips that year.
 *
 * @param files - Each country's officials and trips.
 * @param today - Today's date; this year is counted up to it.
 * @returns One entry per leader and year, newest first.
 */
export const leaderYears = (
    files: ReadonlyMap<
        CountryCode,
        { officials: WarehouseOfficial[]; trips: { officialId: string; startDate: IsoDate }[] }
    >,
    today: IsoDate
): LeaderYear[] => {
    const years = new Map<string, LeaderYear>();
    for (const [country, file] of files) {
        const tripsByOfficialYear = new Map<string, number>();
        for (const trip of file.trips) {
            const key = `${trip.officialId}|${trip.startDate.slice(0, 4)}`;
            tripsByOfficialYear.set(key, (tripsByOfficialYear.get(key) ?? 0) + 1);
        }
        for (const term of leaderTerms(country, file.officials)) {
            for (const year of yearsHeld(term, today)) {
                const key = `${term.official.id}|${year}`;
                // A leader holding two offices at once (King and PM) is counted once a year.
                if (!years.has(key)) {
                    years.set(key, {
                        country,
                        official: term.official.fullName,
                        officialId: term.official.id,
                        role: term.role,
                        title: term.title,
                        trips: tripsByOfficialYear.get(key) ?? 0,
                        year,
                    });
                }
            }
        }
    }
    return [...years.values()].sort(
        (a, b) =>
            b.year - a.year ||
            a.country.localeCompare(b.country) ||
            a.official.localeCompare(b.official)
    );
};

/** Titles of reigning monarchs (and the Pope and Andorra's co-prince, heads of state for life). */
const MONARCH_TITLE =
    /\b(?:king|queen|emperor|empress|shah|sultan|emir|amir|grand duke|grand duchess|prince|co-prince|bey|mwami|tsar|negus|monarch|pope|yang di-pertuan agong)\b/i;

/** One reign's trips, for the monarchs section. */
export interface Reign {
    country: CountryCode;
    isCurrent: boolean;
    official: string;
    trips: number;
    years: number;
}

/**
 * Every monarch's years in office, summed per monarch: anyone whose head-of-state title is a
 * monarch's ("King of Nepal", "Sultan of Oman").
 *
 * @param entries - Leader-years from `leaderYears`.
 * @param files - The country files, for the monarchs' titles.
 * @param today - Today's date.
 * @returns One entry per monarch, fewest trips per year first.
 */
export const monarchReigns = (
    entries: readonly LeaderYear[],
    files: ReadonlyMap<CountryCode, { officials: WarehouseOfficial[] }>,
    today: IsoDate
): Reign[] => {
    const monarchs = new Set(
        [...files.values()].flatMap((file) =>
            file.officials
                .filter((official) =>
                    official.positions.some(
                        (position) =>
                            position.categories.includes("head_of_state") &&
                            MONARCH_TITLE.test(position.title)
                    )
                )
                .map((official) => official.id)
        )
    );
    const currentYear = Number(today.slice(0, 4));
    const reigns = new Map<string, Reign>();
    for (const entry of entries) {
        if (entry.role !== "head_of_state" || !monarchs.has(entry.officialId)) {
            continue;
        }
        const reign = reigns.get(entry.officialId) ?? {
            country: entry.country,
            isCurrent: false,
            official: entry.official,
            trips: 0,
            years: 0,
        };
        reign.trips += entry.trips;
        reign.years += 1;
        reign.isCurrent ||= entry.year === currentYear;
        reigns.set(entry.officialId, reign);
    }
    return [...reigns.values()].sort((a, b) => a.trips / a.years - b.trips / b.years);
};

const summarizeReigns = (reigns: readonly Reign[]) => {
    const years = reigns.reduce((total, reign) => total + reign.years, 0);
    const trips = reigns.reduce((total, reign) => total + reign.trips, 0);
    return {
        reigns: reigns.length,
        tripsPerYear: years ? Math.round((trips / years) * 10) / 10 : 0,
        years,
    };
};

/** Office holders without a photo: by role, and by name for those in office today. */
export const missingPhotos = (
    files: ReadonlyMap<CountryCode, { officials: WarehouseOfficial[] }>
): {
    byRole: Record<string, { total: number; withoutPhoto: number }>;
    currentWithoutPhoto: string[];
} => {
    const byRole: Record<string, { total: number; withoutPhoto: number }> = {};
    const currentWithoutPhoto: string[] = [];
    for (const [country, file] of files) {
        for (const official of file.officials) {
            const [first] = official.positions;
            const role = first?.categories[0] ?? "senior_official";
            const entry = byRole[role] ?? { total: 0, withoutPhoto: 0 };
            entry.total += 1;
            if (!official.photoUrl) {
                entry.withoutPhoto += 1;
                const isCurrent = first !== undefined && first.endDate === null && !first.undated;
                if (isCurrent && LEADER_ROLES.has(role)) {
                    currentWithoutPhoto.push(`${country} · ${official.fullName} (${first.title})`);
                }
            }
            byRole[role] = entry;
        }
    }
    return { byRole, currentWithoutPhoto: currentWithoutPhoto.sort() };
};

interface PeriodSummary {
    leaderYears: number;
    period: string;
    thin: number;
}

const summarize = (period: string, entries: readonly LeaderYear[]): PeriodSummary => ({
    leaderYears: entries.length,
    period,
    thin: entries.filter((entry) => entry.trips <= THIN_YEAR_MAX_TRIPS).length,
});

/**
 * Builds the coverage report from the stored country files and writes it to the warehouse.
 *
 * @param today - Today's date.
 * @returns The summary per period, recent years first.
 */
export const writeCoverageReport = async (today: IsoDate): Promise<PeriodSummary[]> => {
    const files = await readCountries();
    const entries = leaderYears(files, today);
    const reigns = monarchReigns(entries, files, today);
    const monarchs = {
        current: summarizeReigns(reigns.filter((reign) => reign.isCurrent)),
        past: summarizeReigns(reigns.filter((reign) => !reign.isCurrent)),
        // "country · monarch: trips in years (per year)", fewest trips per year first.
        reigns: reigns.map(
            (reign) =>
                `${reign.country} · ${reign.official}${reign.isCurrent ? " (reigning)" : ""}: ${reign.trips} trips in ${reign.years} years (${(reign.trips / reign.years).toFixed(1)}/year)`
        ),
    };
    const recent = entries.filter((entry) => entry.year >= RECENT_FROM_YEAR);
    const older = entries.filter((entry) => entry.year < RECENT_FROM_YEAR);
    const summary = [
        summarize(`${RECENT_FROM_YEAR}–${today.slice(0, 4)}`, recent),
        summarize(`${EARLIEST_YEAR}–${RECENT_FROM_YEAR - 1}`, older),
    ];
    const byCountry = Object.fromEntries(
        [...new Set(entries.map((entry) => entry.country))].sort().map((country) => {
            const own = recent.filter((entry) => entry.country === country);
            return [
                country,
                {
                    recentLeaderYears: own.length,
                    recentThin: own.filter((entry) => entry.trips <= THIN_YEAR_MAX_TRIPS).length,
                },
            ];
        })
    );
    // One line per thin year, as "year · country · official (title): trips", to keep the file short.
    const thin = entries
        .filter((entry) => entry.trips <= THIN_YEAR_MAX_TRIPS)
        .map(
            (entry) =>
                `${entry.year} · ${entry.country} · ${entry.official} (${entry.title}): ${entry.trips}`
        );
    await writeWarehouseFile("coverage.json", {
        byCountry,
        generatedOn: today,
        monarchs,
        photos: missingPhotos(files),
        summary,
        thin,
        thinYearMaxTrips: THIN_YEAR_MAX_TRIPS,
    });
    return summary;
};

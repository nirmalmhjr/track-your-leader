import path from "node:path";

import {
    type GeneratedTrip,
    generatedTripsSchema,
} from "@/features/travel-explorer/data/generated-data.schema";
import type { OfficialRow } from "@/features/travel-explorer/data/travel-index";
import type { CountryCode } from "@/types/geo.types";
import type { IsoDate } from "@/types/travel.types";

import { countrySourceFor, PIPELINE_CONFIG } from "./config";
import { writeAppIndex } from "./extract/app-index";
import { extractCabinet } from "./extract/cabinets.extract";
import { extractIpeaClaims } from "./extract/claims/au-ipea.claims";
import { extractCanadaClaims } from "./extract/claims/canada.claims";
import { extractColtClaims } from "./extract/claims/colt.claims";
import { extractHistorianClaims } from "./extract/claims/historian.claims";
import { extractHistorianVisitClaims } from "./extract/claims/historian-visits.claims";
import { extractNepalMofaClaims } from "./extract/claims/nepal-mofa.claims";
import { extractRelationsClaims } from "./extract/claims/relations.claims";
import { extractSummitClaims } from "./extract/claims/summits.claims";
import { extractUkClaims } from "./extract/claims/uk.claims";
import { extractUkParliamentClaims } from "./extract/claims/uk-parliament.claims";
import { extractGeneralDebateClaims } from "./extract/claims/un-general-debate.claims";
import { extractWhoAssemblyClaims } from "./extract/claims/who-assembly.claims";
import { extractWikipediaClaims } from "./extract/claims/wikipedia.claims";
import { type CountryList, resolveCountries } from "./extract/countries";
import { resolveIdentities } from "./extract/identity";
import {
    currentLeaders,
    extractLeaders,
    fetchCountryContexts,
    fetchMinisterOffices,
    fetchOfficesByLabel,
} from "./extract/leaders.extract";
import { assembleDrafts, enrichOfficials } from "./extract/officials.extract";
import { buildPeopleRows, idRecordsOf, isPromoted, mergePeople } from "./extract/people.assemble";
import { writePeopleFiles } from "./extract/people.export";
import { extractPeople, type PersonDraft } from "./extract/people.extract";
import {
    type CityLookup,
    createCityLookup,
    loadPlaceIndex,
    type PlaceIndex,
    saveCapitals,
} from "./extract/places.resolve";
import { rosterSchema, updateRoster } from "./extract/roster";
import { matchTravellers } from "./extract/travellers.match";
import { mergeClaims } from "./extract/trips.merge";
import { groupBy } from "./lib/collections";
import { isValidDay, todayIso } from "./lib/dates";
import { setCacheBypass } from "./lib/http";
import { readJsonFile, writeJsonFile } from "./lib/json-file";
import { log } from "./lib/log";
import {
    type CountryFile,
    readAllPeople,
    readClaims,
    readCountries,
    type WarehouseOfficial,
    warehouseOfficialSchema,
    writeClaims,
    writeCountry,
    writePeople,
    writeWarehouseFile,
} from "./lib/warehouse";
import { fetchEntities } from "./sources/wikidata";
import { WIKI_LANGUAGES } from "./sources/wikipedia";
import {
    type CountryContext,
    type OfficialDraft,
    type PipelineReport,
    type SkippedRow,
    TRIP_SOURCES,
    type TripClaim,
    type TripSourceId,
} from "./types";
import { checkCountDrop } from "./validate/guard";

export interface PipelineOptions {
    /** Which countries to rebuild; the others keep what the warehouse already holds. */
    countries: "all" | "tracked" | readonly CountryCode[];
    /** Write even if counts dropped sharply. */
    force: boolean;
    /** Ignore the local HTTP cache. */
    refresh: boolean;
    /** Offices held since this year are collected. */
    sinceYear: number;
    /** Sources fetched this run; the others reuse the claims they reported last time. */
    sources: ReadonlySet<TripSourceId>;
}

const MAX_REPORTED_SKIPS = 40;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const isCalendarDate = (value: string): boolean => {
    const match = value.match(ISO_DATE);
    return Boolean(match) && isValidDay(Number(match?.[1]), Number(match?.[2]), Number(match?.[3]));
};

/** A last line of defence: a claim with an impossible date never reaches the warehouse. */
const hasValidDates = (claim: TripClaim): boolean =>
    isCalendarDate(claim.startDate) &&
    isCalendarDate(claim.endDate) &&
    claim.endDate >= claim.startDate;
/**
 * Whether a claim is international travel.
 *
 * @param claim - Claim to test.
 * @returns `false` for a trip within the traveller's own country.
 */
export const isAbroad = (claim: TripClaim): boolean =>
    claim.destination.countryCode !== claim.traveller.countryCode;
const stateFile = (name: string): string => path.join(PIPELINE_CONFIG.stateDir, name);

// --- Officials ------------------------------------------------------------------------------

interface OfficialsResult {
    contexts: Map<CountryCode, CountryContext>;
    drafts: OfficialDraft[];
    roster: Awaited<ReturnType<typeof readRoster>>;
}

const readRoster = async () => (await readJsonFile(stateFile("roster.json"), rosterSchema)) ?? {};

const collectOfficials = async (
    { ciaSlugs, codes }: CountryList,
    sinceYear: number,
    today: IsoDate,
    report: PipelineReport
): Promise<OfficialsResult> => {
    log.step(`Leaders and ministers (Wikidata, since ${sinceYear})`);
    const contexts = await fetchCountryContexts(codes);
    const { offices: ministerOffices, roles } = await fetchMinisterOffices(contexts);
    const labelled = await Promise.all(
        codes.map((code) => fetchOfficesByLabel(countrySourceFor(code).wikidataOffices ?? []))
    );
    const extraOffices = new Map(
        codes.map((code, index) => [
            code,
            [...(ministerOffices.get(code) ?? []), ...labelled[index]],
        ])
    );
    const leaders = await extractLeaders({ contexts, extraOffices, officeRoles: roles, sinceYear });
    log.info(`${leaders.size} office holders in ${contexts.size} countries`);

    log.step("Cabinets (CIA World Leaders)");
    const roster = await readRoster();
    const leadersNow = currentLeaders(leaders);
    const cabinetUrls = new Map<CountryCode, string>();
    const cabinets = await Promise.all(
        codes.map((code) =>
            extractCabinet(code, leadersNow.get(code) ?? [], ciaSlugs.get(code) ?? null)
        )
    );
    for (const [index, code] of codes.entries()) {
        const cabinet = cabinets[index];
        report.cabinets[code] = { asOf: cabinet.asOf, status: cabinet.status };
        if (cabinet.url) {
            cabinetUrls.set(code, cabinet.url);
        }
        updateRoster(roster, code, cabinet, today);
    }
    const usable = cabinets.filter((cabinet) => cabinet.status === "ok").length;
    log.info(`${usable} of ${codes.length} cabinets usable`);

    log.step("Matching cabinet members to Wikidata");
    report.unmatchedOfficials = await resolveIdentities({ contexts, leaders, roster, today });
    log.info(`${report.unmatchedOfficials.length} without a Wikidata match (kept, without photo)`);

    const selected = new Set(codes);
    const drafts = assembleDrafts(leaders, roster, cabinetUrls).filter((draft) =>
        selected.has(draft.countryCode)
    );
    return { contexts, drafts, roster };
};

// --- Trips ----------------------------------------------------------------------------------

interface ClaimsInput {
    cities: CityLookup;
    drafts: readonly OfficialDraft[];
    places: PlaceIndex;
    report: PipelineReport;
    today: IsoDate;
}

interface Extraction {
    claims: TripClaim[];
    skipped: SkippedRow[];
}

const extractSource = async (source: TripSourceId, input: ClaimsInput): Promise<Extraction> => {
    const { cities, places } = input;
    switch (source) {
        case "wikipedia": {
            const people = await fetchEntities(
                input.drafts.flatMap((draft) => draft.wikidataId ?? []),
                ["sitelinks"],
                WIKI_LANGUAGES.map((language) => `${language}wiki`)
            );
            const wikiTitles = new Map(
                [...people.values()].map((person) => [
                    person.id,
                    Object.fromEntries(
                        WIKI_LANGUAGES.flatMap((language) => {
                            const title = person.wikiTitles[`${language}wiki`];
                            return title ? [[language, title]] : [];
                        })
                    ),
                ])
            );
            const claims = await extractWikipediaClaims({ ...input, wikiTitles });
            return { claims, skipped: [] };
        }
        case "colt":
            return extractColtClaims({ cities, places });
        case "historian":
            return extractHistorianClaims({ cities, places });
        case "historian-visits":
            return extractHistorianVisitClaims(places);
        case "gov-uk":
            return extractUkClaims({ cities, places });
        case "canada":
            return extractCanadaClaims({ cities, places });
        case "nepal-mofa":
            return extractNepalMofaClaims(places);
        case "un-general-debate":
            return extractGeneralDebateClaims({ cities });
        case "who-assembly":
            return extractWhoAssemblyClaims({ cities });
        case "uk-parliament":
            return extractUkParliamentClaims({ cities, places });
        case "au-ipea":
            return extractIpeaClaims({ cities, places });
        case "summits":
            return extractSummitClaims({ cities, places });
        case "relations":
            return extractRelationsClaims(places);
        default:
            return { claims: [], skipped: [] };
    }
};

/**
 * Claims from every source for the selected countries: fresh for sources fetched this run,
 * stored ones otherwise. Fresh claims are returned per source too, to be stored after checks.
 */
const collectClaims = async (
    input: ClaimsInput,
    options: PipelineOptions,
    selected: ReadonlySet<CountryCode>
): Promise<{ claims: TripClaim[]; fresh: Map<TripSourceId, TripClaim[]> }> => {
    const claims: TripClaim[] = [];
    const fresh = new Map<TripSourceId, TripClaim[]>();
    for (const source of TRIP_SOURCES) {
        const isFetched = options.sources.has(source);
        log.step(`Trips: ${source}${isFetched ? "" : " (stored)"}`);
        let found: TripClaim[];
        let skipped: SkippedRow[] = [];
        if (isFetched) {
            try {
                // biome-ignore lint/performance/noAwaitInLoops: sources share the HTTP pacing and the city lookup; one at a time keeps both simple.
                ({ claims: found, skipped } = await extractSource(source, input));
                fresh.set(source, found);
            } catch (error) {
                log.warn(`${source} failed, using stored claims: ${(error as Error).message}`);
                found = await readClaims(source);
            }
        } else {
            found = await readClaims(source);
        }
        const valid = found.filter((claim) => hasValidDates(claim));
        if (valid.length < found.length) {
            skipped.push({ reason: "invalid dates", text: `${found.length - valid.length} trips` });
        }
        // Trips at home (a US president's UN speech in New York) aren't international travel.
        const abroad = valid.filter(isAbroad);
        if (abroad.length < valid.length) {
            skipped.push({
                reason: "domestic travel",
                text: `${valid.length - abroad.length} trips`,
            });
        }
        const relevant = abroad.filter((claim) => selected.has(claim.traveller.countryCode));
        claims.push(...relevant);
        input.report.sources[source] = {
            claims: relevant.length,
            matched: 0,
            newOfficials: 0,
            skipped: skipped.slice(0, MAX_REPORTED_SKIPS),
            skippedCount: skipped.length,
            unmatched: 0,
        };
        log.info(
            `${relevant.length} trips reported${skipped.length ? `, ${skipped.length} rows skipped` : ""}`
        );
    }
    return { claims, fresh };
};

// --- Writing --------------------------------------------------------------------------------

const countTrips = (trips: ReadonlyMap<CountryCode, readonly GeneratedTrip[]>): number =>
    [...trips.values()].reduce((total, list) => total + list.length, 0);

// --- Run ------------------------------------------------------------------------------------

type Matches = Awaited<ReturnType<typeof matchTravellers>>;

/** Counts, per source, how many claims found a traveller. */
const tallyMatches = (report: PipelineReport, matches: Matches): void => {
    const newDrafts = new Set(matches.newDrafts);
    for (const [claim, draft] of matches.draftOf) {
        const stats = report.sources[claim.source];
        if (stats) {
            stats.matched += 1;
            stats.newOfficials += newDrafts.has(draft) ? 1 : 0;
        }
    }
    for (const claim of matches.unmatched) {
        const stats = report.sources[claim.source];
        if (stats) {
            stats.unmatched += 1;
        }
    }
};

/** Merges each official's claims into trips, grouped by the official's country. */
const buildTrips = (
    claims: readonly TripClaim[],
    matches: Matches,
    idOf: ReadonlyMap<OfficialDraft, string>
): Map<CountryCode, GeneratedTrip[]> => {
    const tripsByCountry = new Map<CountryCode, GeneratedTrip[]>();
    const matched = claims.filter((claim) => matches.draftOf.has(claim));
    for (const [draft, list] of groupBy(
        matched,
        (claim) => matches.draftOf.get(claim) as OfficialDraft
    )) {
        const id = idOf.get(draft);
        if (!id) {
            continue;
        }
        const trips = generatedTripsSchema.parse(mergeClaims(list, id));
        const country = tripsByCountry.get(draft.countryCode);
        if (country) {
            country.push(...trips);
        } else {
            tripsByCountry.set(draft.countryCode, trips);
        }
    }
    return tripsByCountry;
};

/** Refuses to overwrite the warehouse when a run produced far less than it holds. */
interface DropCheck {
    codes: readonly CountryCode[];
    force: boolean;
    officialCount: number;
    /** People stored before and found now. */
    people: { found: number; stored: number };
    stored: ReadonlyMap<CountryCode, CountryFile>;
    tripsByCountry: ReadonlyMap<CountryCode, readonly GeneratedTrip[]>;
}

const checkDrops = ({
    codes,
    force,
    officialCount,
    people,
    stored,
    tripsByCountry,
}: DropCheck): void => {
    const sum = (count: (file: CountryFile) => number): number =>
        codes.reduce((total, code) => {
            const file = stored.get(code);
            return total + (file ? count(file) : 0);
        }, 0);
    const problems = [
        checkCountDrop(
            "Officials",
            sum((file) => file.officials.length),
            officialCount
        ),
        checkCountDrop(
            "Trips",
            sum((file) => file.trips.length),
            countTrips(tripsByCountry)
        ),
        checkCountDrop("People", people.stored, people.found),
    ].filter((problem): problem is string => problem !== null);
    for (const problem of problems) {
        log.warn(problem);
    }
    if (problems.length > 0 && !force) {
        throw new Error(
            "Nothing written. Check the warehouse report, then rerun with --force if the drop is real."
        );
    }
};

interface WarehouseWrite {
    codes: readonly CountryCode[];
    fresh: ReadonlyMap<TripSourceId, readonly TripClaim[]>;
    officialsByCountry: ReadonlyMap<CountryCode, WarehouseOfficial[]>;
    /** People rows per country. */
    peopleByCountry: ReadonlyMap<CountryCode, OfficialRow[]>;
    report: PipelineReport;
    sinceYear: number;
    today: IsoDate;
    tripsByCountry: ReadonlyMap<CountryCode, GeneratedTrip[]>;
}

/** Writes the selected countries, the fresh claims, the report and the summary. */
const writeWarehouse = async ({
    codes,
    fresh,
    officialsByCountry,
    peopleByCountry,
    report,
    sinceYear,
    today,
    tripsByCountry,
}: WarehouseWrite): Promise<void> => {
    const selected = new Set(codes);
    let changed = 0;
    for (const code of codes) {
        // biome-ignore lint/performance/noAwaitInLoops: files are written one by one to keep memory and output tidy.
        await writePeople(code, peopleByCountry.get(code) ?? []);
    }
    for (const code of codes) {
        const trips = [...(tripsByCountry.get(code) ?? [])].sort((a, b) =>
            a.id.localeCompare(b.id)
        );
        // biome-ignore lint/performance/noAwaitInLoops: files are written one by one to keep memory and output tidy.
        changed += (await writeCountry(code, {
            officials: officialsByCountry.get(code) ?? [],
            trips,
        }))
            ? 1
            : 0;
    }
    await Promise.all(
        [...fresh].map(async ([source, list]) => {
            const others = (await readClaims(source)).filter(
                (claim) => !selected.has(claim.traveller.countryCode)
            );
            await writeClaims(source, [
                ...others,
                ...list.filter((claim) => selected.has(claim.traveller.countryCode)),
            ]);
        })
    );
    await writeWarehouseFile("report.json", report);

    const all = [...(await readCountries()).values()];
    const people = [...(await readAllPeople()).values()];
    await writeWarehouseFile("meta.json", {
        counts: {
            countries: all.length,
            officials: all.reduce((total, file) => total + file.officials.length, 0),
            people: people.reduce((total, rows) => total + rows.length, 0),
            trips: all.reduce((total, file) => total + file.trips.length, 0),
        },
        sinceYear,
        sources: Object.fromEntries(
            Object.entries(report.sources).map(([source, stats]) => [source, stats?.claims ?? 0])
        ),
        updatedOn: today,
    });
    log.info(`${changed} of ${codes.length} country files changed`);
};

/**
 * Collects officials and trips for the selected countries into the warehouse, then refreshes
 * the app's files from it.
 *
 * @param options - What to collect.
 */
export const runPipeline = async (options: PipelineOptions): Promise<void> => {
    setCacheBypass(options.refresh);
    const today = todayIso();
    const report: PipelineReport = {
        cabinets: {},
        sources: {},
        tripPages: [],
        unmatchedOfficials: [],
    };

    log.step("Countries");
    const countries = await resolveCountries(options.countries);
    const selected = new Set(countries.codes);
    log.info(`${countries.codes.length} countries`);

    const stored = await readCountries();
    const previous = [...stored.values()].flatMap((file) => file.officials);
    const reserved = new Set(
        [...stored]
            .filter(([code]) => !selected.has(code))
            .flatMap(([, file]) => file.officials.map((official) => official.id))
    );

    const { contexts, drafts, roster } = await collectOfficials(
        countries,
        options.sinceYear,
        today,
        report
    );

    log.step("Places");
    const places = await loadPlaceIndex();
    await saveCapitals(places);
    const cities = await createCityLookup(places);
    const { claims, fresh } = await collectClaims(
        { cities, drafts, places, report, today },
        options,
        selected
    );

    // Every run sweeps its countries, since some of the people found become officials.
    log.step("Everyone politically exposed (Wikidata, via QLever)");
    const people: PersonDraft[] = mergePeople(
        drafts,
        await extractPeople({ contexts, sinceYear: options.sinceYear, today })
    );
    log.info(`${people.length} people beyond the leaders and cabinets`);

    log.step("Matching trips to officials");
    const matches = await matchTravellers(claims, [...drafts, ...people], contexts, today);
    tallyMatches(report, matches);
    log.info(
        `${matches.draftOf.size} trips matched, ${matches.newDrafts.length} new officials, ${matches.unmatched.length} without a traveller`
    );

    // Travellers and the executive get full records; everyone else goes to the people store.
    const travelled = new Set(matches.draftOf.values());
    const promoted = people.filter((person) => isPromoted(person, travelled));
    const rest = people.filter((person) => !isPromoted(person, travelled));
    const storedPeople = await readAllPeople();
    const previousPeople = idRecordsOf(storedPeople);
    const reservedPeople = idRecordsOf(
        new Map([...storedPeople].filter(([code]) => !selected.has(code)))
    ).map((record) => record.id);

    log.step("Officials: photos, parties, biographies");
    const { idOf, officials } = await enrichOfficials(
        [...drafts, ...matches.newDrafts, ...promoted],
        [...previous, ...previousPeople],
        new Set([...reserved, ...reservedPeople])
    );
    const peopleByCountry = buildPeopleRows({
        people: rest,
        previous: [...previous, ...previousPeople],
        reserved: new Set([
            ...reserved,
            ...reservedPeople,
            ...officials.map((official) => official.id),
        ]),
    });
    const officialsByCountry = groupBy(
        officials.map((official) => {
            const parsed = warehouseOfficialSchema.safeParse(official);
            if (!parsed.success) {
                throw new Error(
                    `Invalid official ${official.countryCode} ${official.fullName}: ${JSON.stringify(official.positions)}`
                );
            }
            return parsed.data;
        }),
        (official) => official.countryCode
    );

    log.step("Merging trips");
    const tripsByCountry = buildTrips(claims, matches, idOf);
    log.info(`${countTrips(tripsByCountry)} trips for ${officials.length} officials`);

    log.step("Checks");
    checkDrops({
        codes: countries.codes,
        force: options.force,
        officialCount: officials.length,
        people: {
            found: [...peopleByCountry.values()].reduce((total, rows) => total + rows.length, 0),
            stored: countries.codes.reduce(
                (total, code) => total + (storedPeople.get(code)?.length ?? 0),
                0
            ),
        },
        stored,
        tripsByCountry,
    });

    log.step("Writing the warehouse");
    await writeWarehouse({
        codes: countries.codes,
        fresh,
        officialsByCountry,
        peopleByCountry,
        report,
        sinceYear: options.sinceYear,
        today,
        tripsByCountry,
    });
    await cities.save();
    await writeJsonFile(stateFile("roster.json"), roster);

    log.step("App index");
    await writeAppIndex(today, options.force);
    await writePeopleFiles();
};

/**
 * Reads the command-line flags shared by `data:collect` and `data:sync`.
 *
 * @param argv - Arguments after the script name.
 * @param defaults - Values used when a flag is absent.
 * @returns Pipeline options.
 */
export const parseOptions = (
    argv: readonly string[],
    defaults: PipelineOptions
): PipelineOptions => {
    const flag = (name: string): string | undefined =>
        argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
    const countries = flag("countries");
    const sources = flag("sources");
    const since = Number(flag("since"));
    const sourceIds = sources
        ?.split(",")
        .filter((id): id is TripSourceId => (TRIP_SOURCES as readonly string[]).includes(id));

    let countrySelection = defaults.countries;
    if (countries === "all" || countries === "tracked") {
        countrySelection = countries;
    } else if (countries) {
        countrySelection = countries.split(",").map((code) => code.trim().toUpperCase());
    }
    return {
        countries: countrySelection,
        force: argv.includes("--force") || defaults.force,
        refresh: argv.includes("--refresh") || defaults.refresh,
        sinceYear: Number.isFinite(since) && since > 0 ? since : defaults.sinceYear,
        sources: sourceIds ? new Set(sourceIds) : defaults.sources,
    };
};

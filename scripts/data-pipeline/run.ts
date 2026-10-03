/**
 * Data pipeline entry point: `pnpm data:sync` (add `--refresh` to bypass the local cache,
 * `--force` to write even if counts dropped sharply). See README.md in this folder.
 */
import path from "node:path";

import {
    generatedMetaSchema,
    generatedOfficialsSchema,
    generatedTripsSchema,
} from "@/features/travel-explorer/data/generated-data.schema";
import { TRACKED_COUNTRIES } from "@/features/travel-explorer/data/tracked-countries";
import type { CountryCode } from "@/types/geo.types";

import { COUNTRY_SOURCES, PIPELINE_CONFIG } from "./config";
import { extractCabinet } from "./extract/cabinets.extract";
import { resolveIdentities } from "./extract/identity";
import {
    currentLeaders,
    extractLeaders,
    fetchCountryContexts,
    fetchOfficesByLabel,
} from "./extract/leaders.extract";
import { assembleDrafts, enrichOfficials } from "./extract/officials.extract";
import { rosterSchema, updateRoster } from "./extract/roster";
import { extractTrips } from "./extract/trips.extract";
import { todayIso } from "./lib/dates";
import { setCacheBypass } from "./lib/http";
import { readJsonFile, writeJsonFile } from "./lib/json-file";
import { log } from "./lib/log";
import type { PipelineReport } from "./types";
import { checkCountDrop } from "./validate/guard";

const args = new Set(process.argv.slice(2));
const outputFile = (name: string): string => path.join(PIPELINE_CONFIG.outputDir, name);
const stateFile = (name: string): string => path.join(PIPELINE_CONFIG.stateDir, name);

const syncOfficials = async (today: string, report: PipelineReport) => {
    const previous =
        (await readJsonFile(outputFile("officials.json"), generatedOfficialsSchema)) ?? [];
    const roster = (await readJsonFile(stateFile("roster.json"), rosterSchema)) ?? {};
    const codes = TRACKED_COUNTRIES.map((country) => country.code);

    log.step("Leaders (Wikidata)");
    const contexts = await fetchCountryContexts(codes);
    const extraOffices = new Map(
        await Promise.all(
            codes.map(
                async (code) =>
                    [
                        code,
                        await fetchOfficesByLabel(COUNTRY_SOURCES[code]?.wikidataOffices ?? []),
                    ] as const
            )
        )
    );
    const leaders = await extractLeaders({ contexts, extraOffices });
    log.info(`${leaders.size} office holders since ${PIPELINE_CONFIG.sinceYear}`);

    log.step("Cabinets (CIA World Leaders)");
    const leadersNow = currentLeaders(leaders);
    const cabinetUrls = new Map<CountryCode, string>();
    const cabinets = await Promise.all(
        codes.map((code) => extractCabinet(code, leadersNow.get(code) ?? []))
    );
    for (const [index, code] of codes.entries()) {
        const cabinet = cabinets[index];
        report.cabinets[code] = { asOf: cabinet.asOf, status: cabinet.status };
        if (cabinet.url) {
            cabinetUrls.set(code, cabinet.url);
        }
        updateRoster(roster, code, cabinet, today);
        log.info(
            `${code}: ${cabinet.status}, ${cabinet.members.length} members (as of ${cabinet.asOf ?? "n/a"})`
        );
    }

    log.step("Matching cabinet members to Wikidata");
    report.unmatchedOfficials = await resolveIdentities({ contexts, leaders, roster, today });
    log.info(`${report.unmatchedOfficials.length} without a Wikidata match (kept, without photo)`);

    log.step("Officials: photos, parties, biographies");
    const officials = generatedOfficialsSchema.parse(
        await enrichOfficials(assembleDrafts(leaders, roster, cabinetUrls), previous)
    );
    return { officials, previous, roster };
};

const main = async (): Promise<void> => {
    setCacheBypass(args.has("--refresh"));
    const today = todayIso();
    const report: PipelineReport = { cabinets: {}, tripPages: [], unmatchedOfficials: [] };

    const { officials, previous, roster } = await syncOfficials(today, report);

    log.step("Trips (Wikipedia)");
    const previousTrips =
        (await readJsonFile(outputFile("trips.json"), generatedTripsSchema)) ?? [];
    const trips = generatedTripsSchema.parse(await extractTrips(officials, report, today));

    log.step("Checks");
    const problems = [
        checkCountDrop("Officials", previous.length, officials.length),
        checkCountDrop("Trips", previousTrips.length, trips.length),
    ].filter((problem): problem is string => problem !== null);
    for (const problem of problems) {
        log.warn(problem);
    }
    if (problems.length > 0 && !args.has("--force")) {
        throw new Error(
            "Nothing written. Check state/report.json, then rerun with --force if the drop is real."
        );
    }

    log.step("Writing");
    const officialsChanged = await writeJsonFile(outputFile("officials.json"), officials);
    const tripsChanged = await writeJsonFile(outputFile("trips.json"), trips);
    const hasMeta = (await readJsonFile(outputFile("meta.json"), generatedMetaSchema)) !== null;
    if (officialsChanged || tripsChanged || !hasMeta) {
        await writeJsonFile(outputFile("meta.json"), {
            cabinets: report.cabinets,
            counts: { officials: officials.length, trips: trips.length },
            sinceYear: PIPELINE_CONFIG.sinceYear,
            updatedOn: today,
        });
    }
    await writeJsonFile(stateFile("roster.json"), roster);
    await writeJsonFile(stateFile("report.json"), report);

    log.info(`${officials.length} officials, ${trips.length} trips`);
    log.info(officialsChanged || tripsChanged ? "Data changed." : "No changes.");
};

main().catch((error: unknown) => {
    log.warn(error instanceof Error ? (error.stack ?? error.message) : String(error));
    process.exitCode = 1;
});

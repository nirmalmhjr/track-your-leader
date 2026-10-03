import type {
    IsoDate,
    TravelDataset,
    TravelRecord,
} from "@/features/travel-explorer/types/travel.types";
import { toIsoDate } from "@/features/travel-explorer/utils/date.utils";
import { resolvePositionTitle } from "@/features/travel-explorer/utils/positions.utils";
import { resolveTravelStatus } from "@/features/travel-explorer/utils/travel-status.utils";

import generatedMeta from "./generated/meta.json";
import generatedOfficials from "./generated/officials.json";
import generatedTrips from "./generated/trips.json";
import {
    type GeneratedTrip,
    generatedMetaSchema,
    generatedOfficialsSchema,
    generatedTripsSchema,
} from "./generated-data.schema";
import { buildSampleTravelDataset } from "./sample/sample-dataset";
import { TRACKED_COUNTRIES } from "./tracked-countries";

const compareRecordsNewestFirst = (a: TravelRecord, b: TravelRecord): number =>
    b.startDate.localeCompare(a.startDate) || a.id.localeCompare(b.id);

/**
 * Builds the dataset from the files written by the data pipeline (`pnpm data:sync`).
 *
 * @param today - Reference date for status calculation.
 * @returns The dataset, or `null` before the pipeline has produced any officials.
 */
const buildGeneratedDataset = (today: IsoDate): TravelDataset | null => {
    // Validated here as well as in the pipeline: a malformed file fails the build instead of
    // shipping a broken page.
    const officials = generatedOfficialsSchema.parse(generatedOfficials);
    const trips = generatedTripsSchema.parse(generatedTrips);
    if (officials.length === 0) {
        return null;
    }

    const officialById = new Map(officials.map((official) => [official.id, official]));
    const countryByCode = new Map(TRACKED_COUNTRIES.map((country) => [country.code, country]));

    const toRecord = ({ statusHint, ...trip }: GeneratedTrip): TravelRecord[] => {
        const official = officialById.get(trip.officialId);
        const country = official ? countryByCode.get(official.countryCode) : undefined;
        if (!(official && country)) {
            return [];
        }

        return [
            {
                ...trip,
                origin: country.capital,
                originCountryCode: country.code,
                positionTitle: resolvePositionTitle(official, trip.startDate),
                status: resolveTravelStatus({
                    datePrecision: trip.datePrecision,
                    endDate: trip.endDate,
                    hint: statusHint,
                    today,
                }),
            },
        ];
    };

    return {
        countries: TRACKED_COUNTRIES,
        officials,
        records: trips.flatMap(toRecord).sort(compareRecordsNewestFirst),
    };
};

const TODAY = toIsoDate(new Date());
const generatedDataset = buildGeneratedDataset(TODAY);

/**
 * Where the explorer's data comes from: the pipeline's files, or the fictional samples on a
 * fresh checkout before `pnpm data:sync` has run.
 */
export const TRAVEL_DATA_SOURCE: "generated" | "sample" = generatedDataset ? "generated" : "sample";

/** Day the pipeline last changed the data, or `null` when showing samples. */
export const TRAVEL_DATA_UPDATED_ON: IsoDate | null = generatedDataset
    ? generatedMetaSchema.parse(generatedMeta).updatedOn
    : null;

/** Dataset evaluated against the viewer's current date. */
export const TRAVEL_DATASET: TravelDataset = generatedDataset ?? buildSampleTravelDataset(TODAY);

import { ROUTES } from "@/configs/routes";
import { getCountryReference } from "@/lib/geo/country-reference";
import type { CountryCode } from "@/types/geo.types";
import type {
    IsoDate,
    Official,
    TravelRecord,
    TravelStatus,
    TravelType,
} from "@/types/travel.types";

/*
 * Trip spreadsheets for download. Headers and values stay in English whatever the site language,
 * so files from different visitors line up and can be combined.
 */

export const TRIPS_CSV_MIME_TYPE = "text/csv;charset=utf-8";

/** Byte order mark: without it, Excel reads UTF-8 files as the system code page. */
const BYTE_ORDER_MARK = "﻿";
/** RFC 4180 line separator. */
const LINE_BREAK = "\r\n";
const ENGAGEMENT_SEPARATOR = "; ";
const SOURCE_SEPARATOR = " | ";
const FILE_EXTENSION = ".csv";
const FILTERED_SUFFIX = "filtered";

/** Characters that force a cell to be quoted. */
const NEEDS_QUOTING_PATTERN = /[",\r\n]/;
const QUOTE_PATTERN = /"/g;
/** Spreadsheets run cells starting with these as formulas; a leading apostrophe stops that. */
const FORMULA_TRIGGER_PATTERN = /^[=+\-@\t\r]/;
const DIACRITICS_PATTERN = /\p{Diacritic}/gu;
const NON_SLUG_PATTERN = /[^a-z0-9]+/g;
const EDGE_HYPHENS_PATTERN = /^-+|-+$/g;

const STATUS_LABELS: Readonly<Record<TravelStatus, string>> = {
    cancelled: "Cancelled",
    completed: "Completed",
    planned: "Planned",
    upcoming: "Upcoming",
};

const TYPE_LABELS: Readonly<Record<TravelType, string>> = {
    bilateral_meeting: "Bilateral meeting",
    conference: "Conference",
    diplomatic_visit: "Diplomatic visit",
    extended_stay: "Extended stay",
    multilateral_meeting: "Multilateral meeting",
    official_visit: "Official visit",
    other: "Other",
    state_visit: "State visit",
    summit: "Summit",
};

/** What a trips file is built from. */
export interface TripsCsvInput {
    /** Officials of the trips, for names; trips by unknown officials keep the bare id. */
    officialById: ReadonlyMap<string, Official>;
    records: readonly TravelRecord[];
}

interface TripsCsvOptions extends TripsCsvInput {
    /** Site origin used for profile links, without a trailing slash. */
    baseUrl: string;
}

interface TripsCsvColumn {
    header: string;
    value: (record: TravelRecord, official: Official | undefined, baseUrl: string) => string;
}

/**
 * English name of a country.
 *
 * @param code - Country code.
 * @returns The reference name, or the code when the country is unknown.
 */
export const getEnglishCountryName = (code: CountryCode): string =>
    getCountryReference(code)?.name ?? code;

/** Column order of every trips file. */
export const TRIPS_CSV_COLUMNS: readonly TripsCsvColumn[] = [
    { header: "Start date", value: (record) => record.startDate },
    { header: "End date", value: (record) => record.endDate },
    { header: "Status", value: (record) => STATUS_LABELS[record.status] },
    { header: "Official", value: (record, official) => official?.fullName ?? record.officialId },
    { header: "Position at the time", value: (record) => record.positionTitle },
    {
        header: "Origin country",
        value: (record) => getEnglishCountryName(record.originCountryCode),
    },
    { header: "Origin country code", value: (record) => record.originCountryCode },
    {
        header: "Destination city",
        // Country-precision places sit on the capital only so the map can draw them.
        value: (record) =>
            record.destination.precision === "country" ? "" : record.destination.city,
    },
    {
        header: "Destination country",
        value: (record) => getEnglishCountryName(record.destination.countryCode),
    },
    { header: "Destination country code", value: (record) => record.destination.countryCode },
    { header: "Trip type", value: (record) => TYPE_LABELS[record.type] },
    { header: "Event", value: (record) => record.eventName ?? "" },
    { header: "Purpose", value: (record) => record.purpose },
    { header: "Engagements", value: (record) => record.engagements.join(ENGAGEMENT_SEPARATOR) },
    {
        header: "Sources",
        value: (record) =>
            record.sources.map((source) => `${source.label}: ${source.url}`).join(SOURCE_SEPARATOR),
    },
    {
        header: "Profile URL",
        value: (record, _official, baseUrl) =>
            `${baseUrl}${ROUTES.leadersProfile(record.originCountryCode, record.officialId)}`,
    },
];

/**
 * Makes a value safe for one CSV cell: neutralises formulas, then quotes per RFC 4180.
 *
 * @param value - Raw cell text.
 * @returns The cell as written to the file.
 */
export const escapeCsvCell = (value: string): string => {
    const safe = FORMULA_TRIGGER_PATTERN.test(value) ? `'${value}` : value;
    return NEEDS_QUOTING_PATTERN.test(safe) ? `"${safe.replace(QUOTE_PATTERN, '""')}"` : safe;
};

/**
 * Builds a spreadsheet of trips, one row per trip in the order given.
 *
 * @param options - Trips, their officials and the site origin for profile links.
 * @returns UTF-8 CSV text with a byte order mark and a header row.
 */
export const buildTripsCsv = ({ records, officialById, baseUrl }: TripsCsvOptions): string => {
    const lines = [TRIPS_CSV_COLUMNS.map((column) => escapeCsvCell(column.header)).join(",")];
    for (const record of records) {
        const official = officialById.get(record.officialId);
        lines.push(
            TRIPS_CSV_COLUMNS.map((column) =>
                escapeCsvCell(column.value(record, official, baseUrl))
            ).join(",")
        );
    }
    return `${BYTE_ORDER_MARK}${lines.join(LINE_BREAK)}${LINE_BREAK}`;
};

const slugify = (value: string): string =>
    value
        .normalize("NFD")
        .replace(DIACRITICS_PATTERN, "")
        .toLowerCase()
        .replace(NON_SLUG_PATTERN, "-")
        .replace(EDGE_HYPHENS_PATTERN, "");

interface TripsFileNameOptions {
    /** Whether the file holds only the trips matching the visitor's filters. */
    filtered: boolean;
    /** Words describing the contents, e.g. `["Nepal", "officials", "trips"]`. */
    subject: readonly string[];
    /** Day the data was last updated. */
    updatedOn: IsoDate;
}

/**
 * Names a trips file, e.g. `nepal-officials-trips-2026-10-04.csv`.
 *
 * @param options - What the file holds and when the data was updated.
 * @returns An ASCII file name of lowercase words joined by hyphens.
 */
export const buildTripsFileName = ({
    subject,
    filtered,
    updatedOn,
}: TripsFileNameOptions): string => {
    const parts = [...subject.map(slugify), filtered ? FILTERED_SUFFIX : "", slugify(updatedOn)];
    return `${parts.filter(Boolean).join("-")}${FILE_EXTENSION}`;
};

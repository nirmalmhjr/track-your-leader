import type {
    ExplorerSelection,
    SequentialScale,
} from "@/features/travel-explorer/types/explorer.types";
import {
    buildSequentialScale,
    countTrips,
} from "@/features/travel-explorer/utils/travel-aggregates.utils";
import { isFutureStatus } from "@/lib/travel/travel-summary.utils";
import type { CountryCode } from "@/types/geo.types";
import type { Place, TrackedCountry, TravelRecord, TravelStatus } from "@/types/travel.types";

export type MapMode = "world" | "outbound" | "inbound";
export type RouteTone = "past" | "future" | "cancelled";

export interface RouteSegment {
    from: Place;
    key: string;
    records: readonly TravelRecord[];
    status: TravelStatus;
    to: Place;
    tone: RouteTone;
}

export interface MapNode {
    key: string;
    latest: TravelRecord;
    place: Place;
    records: readonly TravelRecord[];
    tone: RouteTone;
}

export interface MapScene {
    /** Endpoints inside the focus country: its capital outbound, visited cities inbound. */
    anchors: readonly Place[];
    focusCountry: CountryCode | null;
    mode: MapMode;
    /** Endpoints away from the focus country: destinations outbound, origins inbound. */
    nodes: readonly MapNode[];
    /** Trips represented on the map. */
    records: readonly TravelRecord[];
    /**
     * Routes, endpoints and shading are held back until an official is picked: every year of a
     * country's former officials would bury the map in lines.
     */
    routesHidden: boolean;
    scale: SequentialScale;
    segments: readonly RouteSegment[];
    /** City labels are shown when the set of nodes is small enough to read. */
    showLabels: boolean;
    /** Trip counts per country used for sequential shading. */
    values: ReadonlyMap<CountryCode, number>;
}

interface SceneInput {
    countryByCode: ReadonlyMap<CountryCode, TrackedCountry>;
    /** The country's officials tab is on its former side, which spans every year. */
    isFormerSide: boolean;
    matchingRecords: readonly TravelRecord[];
    recordsByDestination: ReadonlyMap<CountryCode, readonly TravelRecord[]>;
    recordsByOfficial: ReadonlyMap<string, readonly TravelRecord[]>;
    recordsByOrigin: ReadonlyMap<CountryCode, readonly TravelRecord[]>;
    selection: ExplorerSelection;
}

const toneOf = (status: TravelStatus): RouteTone => {
    if (status === "cancelled") {
        return "cancelled";
    }
    return isFutureStatus(status) ? "future" : "past";
};

const placeKey = (place: Place): string => `${place.countryCode}:${place.city}`;

const segmentStatus = (tone: RouteTone, records: readonly TravelRecord[]): TravelStatus => {
    if (tone === "past") {
        return "completed";
    }
    if (tone === "cancelled") {
        return "cancelled";
    }
    return records.every((record) => record.status === "planned") ? "planned" : "upcoming";
};

const buildSegments = (records: readonly TravelRecord[]): RouteSegment[] => {
    const groups = new Map<string, TravelRecord[]>();

    for (const record of records) {
        const key = `${placeKey(record.origin)}>${placeKey(record.destination)}|${toneOf(record.status)}`;
        const group = groups.get(key);
        if (group) {
            group.push(record);
        } else {
            groups.set(key, [record]);
        }
    }

    return [...groups.entries()].map(([key, group]) => {
        const tone = toneOf(group[0].status);
        return {
            from: group[0].origin,
            key,
            records: group,
            status: segmentStatus(tone, group),
            to: group[0].destination,
            tone,
        };
    });
};

const nodeTone = (records: readonly TravelRecord[]): RouteTone => {
    if (records.some((record) => record.status === "completed")) {
        return "past";
    }
    return records.some((record) => isFutureStatus(record.status)) ? "future" : "cancelled";
};

const buildNodes = (
    records: readonly TravelRecord[],
    getPlace: (record: TravelRecord) => Place
): MapNode[] => {
    const groups = new Map<string, TravelRecord[]>();

    for (const record of records) {
        const key = placeKey(getPlace(record));
        const group = groups.get(key);
        if (group) {
            group.push(record);
        } else {
            groups.set(key, [record]);
        }
    }

    return [...groups.entries()]
        .map(([key, group]) => {
            const sorted = [...group].sort((a, b) => b.startDate.localeCompare(a.startDate));
            return {
                key,
                latest: sorted[0],
                place: getPlace(sorted[0]),
                records: sorted,
                tone: nodeTone(sorted),
            };
        })
        .sort((a, b) => b.records.length - a.records.length);
};

const uniquePlaces = (places: readonly Place[]): Place[] => [
    ...new Map(places.map((place) => [placeKey(place), place])).values(),
];

const LABEL_NODE_LIMIT = 14;

/**
 * Derives everything the map draws for the current selection: shading values, route
 * segments and endpoints. Kept pure so the map and its legend stay consistent.
 *
 * @param input - Selection plus the filtered, indexed dataset.
 * @returns The scene to render.
 */
export const buildMapScene = ({
    selection,
    matchingRecords,
    recordsByOrigin,
    recordsByDestination,
    recordsByOfficial,
    countryByCode,
    isFormerSide,
}: SceneInput): MapScene => {
    const focusCountry = selection.country;

    if (!focusCountry) {
        const values = countTrips(matchingRecords, (record) => record.originCountryCode);
        return {
            anchors: [],
            focusCountry: null,
            mode: "world",
            nodes: [],
            records: matchingRecords,
            routesHidden: false,
            scale: buildSequentialScale(Math.max(0, ...values.values())),
            segments: [],
            showLabels: false,
            values,
        };
    }

    const isInbound = selection.view === "inbound" && !selection.official;

    if (isInbound) {
        const records = recordsByDestination.get(focusCountry) ?? [];
        const values = countTrips(records, (record) => record.originCountryCode);
        const nodes = buildNodes(records, (record) => record.origin);
        return {
            anchors: uniquePlaces(records.map((record) => record.destination)),
            focusCountry,
            mode: "inbound",
            nodes,
            records,
            routesHidden: false,
            scale: buildSequentialScale(Math.max(0, ...values.values())),
            segments: buildSegments(records),
            showLabels: nodes.length <= LABEL_NODE_LIMIT,
            values,
        };
    }

    if (isFormerSide && !selection.official) {
        return {
            anchors: [],
            focusCountry,
            mode: "outbound",
            nodes: [],
            records: recordsByOrigin.get(focusCountry) ?? [],
            routesHidden: true,
            scale: buildSequentialScale(0),
            segments: [],
            showLabels: false,
            values: new Map(),
        };
    }

    const records = selection.official
        ? (recordsByOfficial.get(selection.official) ?? [])
        : (recordsByOrigin.get(focusCountry) ?? []);
    const values = countTrips(records, (record) => record.destination.countryCode);
    const nodes = buildNodes(records, (record) => record.destination);
    const capital = countryByCode.get(focusCountry)?.capital;

    return {
        anchors: capital ? [capital] : [],
        focusCountry,
        mode: "outbound",
        nodes,
        records,
        routesHidden: false,
        scale: buildSequentialScale(Math.max(0, ...values.values())),
        segments: buildSegments(records),
        showLabels: Boolean(selection.official) || nodes.length <= LABEL_NODE_LIMIT,
        values,
    };
};

import type {
    DatePrecision,
    IsoDate,
    TravelStatus,
} from "@/features/travel-explorer/types/travel.types";

/** What a source says about a trip's status beyond its dates. */
export type TravelStatusHint = "cancelled" | "planned" | null;

interface TravelStatusInput {
    datePrecision: DatePrecision;
    endDate: IsoDate;
    hint: TravelStatusHint;
    today: IsoDate;
}

/**
 * Derives a trip's status from its dates, so trips move from upcoming to completed as time
 * passes without the data being rewritten.
 *
 * @returns `cancelled` when a source says so, `completed` once the trip has ended, `planned` for
 * tentative or loosely dated future trips, otherwise `upcoming` (including trips under way).
 */
export const resolveTravelStatus = ({
    datePrecision,
    endDate,
    hint,
    today,
}: TravelStatusInput): TravelStatus => {
    if (hint === "cancelled") {
        return "cancelled";
    }
    if (endDate < today) {
        return "completed";
    }
    if (hint === "planned" || datePrecision !== "day") {
        return "planned";
    }
    return "upcoming";
};

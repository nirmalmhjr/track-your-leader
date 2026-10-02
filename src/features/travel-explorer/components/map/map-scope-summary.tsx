"use client";

import { useTranslations } from "next-intl";

import { RouteLineKey } from "@/features/travel-explorer/components/travel-status";
import { TRAVEL_STATUSES } from "@/features/travel-explorer/constants/explorer.constants";
import { useDateRangeLabel } from "@/features/travel-explorer/hooks/use-date-range-label";
import { useExplorerData } from "@/features/travel-explorer/hooks/use-explorer-data";
import { useExplorerFormat } from "@/features/travel-explorer/hooks/use-explorer-format";
import { useExplorerState } from "@/features/travel-explorer/hooks/use-explorer-state";
import type { MapScene } from "@/features/travel-explorer/utils/map-scene.utils";

/**
 * States what the map currently shows: whose travel, how many trips and which dates, so the
 * scope is never ambiguous while panning around.
 */
export function MapScopeSummary({ scene, left }: { scene: MapScene; left: number }) {
    const t = useTranslations("Explorer.map.scope");
    const tStatus = useTranslations("Explorer.statuses");
    const format = useExplorerFormat();
    const describeRange = useDateRangeLabel();
    const { officialById } = useExplorerData();
    const { filters, selection } = useExplorerState();

    const focusName = scene.focusCountry ? format.countryName(scene.focusCountry) : "";
    const officialName = selection.official ? officialById.get(selection.official)?.fullName : null;
    let subject = t("world");
    if (scene.mode === "inbound") {
        subject = t("inbound", { country: focusName });
    } else if (officialName) {
        subject = t("official", { name: officialName });
    } else if (scene.mode === "outbound") {
        subject = t("outbound", { country: focusName });
    }

    // Cancelled trips never happened, so they are listed in the breakdown but not counted.
    const tripCount = scene.records.filter((record) => record.status !== "cancelled").length;
    const counts = TRAVEL_STATUSES.map((status) => ({
        count: scene.records.filter((record) => record.status === status).length,
        status,
    })).filter((entry) => entry.count > 0);

    return (
        <section
            aria-live="polite"
            className="absolute top-3 z-10 flex max-w-[min(26rem,calc(100%-5rem))] flex-col gap-1 rounded-md border bg-background px-3 py-2 shadow-sm"
            style={{ left }}
        >
            <p className="truncate font-medium text-sm">{subject}</p>
            <p className="truncate text-muted-foreground text-xs">
                {t("trips", {
                    count: tripCount,
                    countLabel: format.number(tripCount),
                })}
                {" · "}
                {describeRange(filters.from, filters.to)}
            </p>
            {counts.length > 0 ? (
                <ul className="hidden flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground sm:flex">
                    {counts.map(({ status, count }) => (
                        <li className="flex items-center gap-1.5" key={status}>
                            <RouteLineKey className="w-4" status={status} />
                            <span className="tabular-nums">{format.number(count)}</span>
                            {tStatus(status)}
                        </li>
                    ))}
                </ul>
            ) : null}
        </section>
    );
}

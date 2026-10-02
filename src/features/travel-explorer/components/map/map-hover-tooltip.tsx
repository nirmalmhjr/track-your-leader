"use client";

import { useTranslations } from "next-intl";

import { CountryFlag } from "@/components/shared/country-flag";
import { useExplorerData } from "@/features/travel-explorer/hooks/use-explorer-data";
import { useExplorerFormat } from "@/features/travel-explorer/hooks/use-explorer-format";
import type { MapCountryShape } from "@/features/travel-explorer/utils/map-geometry.utils";
import type { MapNode, MapScene } from "@/features/travel-explorer/utils/map-scene.utils";
import { isFutureStatus } from "@/features/travel-explorer/utils/travel-aggregates.utils";
import { getCountryReference } from "@/lib/geo/country-reference";

export type MapHoverTarget =
    | { kind: "country"; shape: MapCountryShape; x: number; y: number }
    | { kind: "node"; node: MapNode; x: number; y: number };

interface MapHoverTooltipProps {
    height: number;
    scene: MapScene;
    target: MapHoverTarget;
    width: number;
}

const TOOLTIP_OFFSET = 14;
const TOOLTIP_WIDTH = 240;
const TOOLTIP_HEIGHT = 84;

function CountryTooltipBody({ shape, scene }: { shape: MapCountryShape; scene: MapScene }) {
    const t = useTranslations("Explorer.map.tooltip");
    const format = useExplorerFormat();
    const { countryByCode, officialsByCountry, recordsByDestination } = useExplorerData();
    const { reference } = shape;
    const code = reference?.alpha3;

    if (!(reference && code)) {
        return <p className="font-medium text-sm">{shape.name}</p>;
    }

    const value = scene.values.get(code) ?? 0;
    const focusName = scene.focusCountry ? format.countryName(scene.focusCountry) : "";
    const isTracked = countryByCode.has(code);
    let detail = reference.subregion;

    if (code === scene.focusCountry) {
        detail = t("selected");
    } else if (scene.mode === "world" && isTracked) {
        const officials = officialsByCountry.get(code)?.length ?? 0;
        detail = t("worldTracked", {
            officials,
            officialsLabel: format.number(officials),
            trips: value,
            tripsLabel: format.number(value),
        });
    } else if (scene.mode === "world") {
        const visits = (recordsByDestination.get(code) ?? []).filter(
            (record) => record.status !== "cancelled"
        ).length;
        detail = t("worldUntracked", { visits, visitsLabel: format.number(visits) });
    } else if (scene.mode === "outbound" && value > 0) {
        detail = t("visitsFrom", {
            count: value,
            countLabel: format.number(value),
            country: focusName,
        });
    } else if (scene.mode === "inbound" && value > 0) {
        detail = t("visitsTo", {
            count: value,
            countLabel: format.number(value),
            country: focusName,
        });
    }

    return (
        <>
            <p className="flex items-center gap-2 font-medium text-sm">
                <CountryFlag alpha2={reference.alpha2} size="sm" />
                {format.countryName(code)}
            </p>
            <p className="text-muted-foreground">{detail}</p>
            {code === scene.focusCountry ? null : (
                <p className="text-muted-foreground/80">{t("clickHint")}</p>
            )}
        </>
    );
}

function NodeTooltipBody({ node }: { node: MapNode }) {
    const t = useTranslations("Explorer.map.tooltip");
    const format = useExplorerFormat();
    const [next] = node.records
        .filter((record) => isFutureStatus(record.status))
        .sort((a, b) => a.startDate.localeCompare(b.startDate));

    return (
        <>
            <p className="flex items-center gap-2 font-medium text-sm">
                <CountryFlag
                    alpha2={getCountryReference(node.place.countryCode)?.alpha2}
                    size="sm"
                />
                {node.place.city}, {format.countryName(node.place.countryCode)}
            </p>
            <p className="text-muted-foreground">
                {t("nodeTrips", {
                    count: node.records.length,
                    countLabel: format.number(node.records.length),
                    date: format.date(node.latest.startDate),
                })}
            </p>
            {next ? (
                <p className="text-muted-foreground">
                    {t("nodeNext", { date: format.date(next.startDate) })}
                </p>
            ) : null}
            <p className="text-muted-foreground/80">{t("nodeHint")}</p>
        </>
    );
}

/**
 * Pointer-following tooltip. It only ever repeats information that is also reachable in the
 * panel, so touch and keyboard users lose nothing.
 */
export function MapHoverTooltip({ target, scene, width, height }: MapHoverTooltipProps) {
    const left = Math.min(target.x + TOOLTIP_OFFSET, width - TOOLTIP_WIDTH);
    const top =
        target.y + TOOLTIP_OFFSET + TOOLTIP_HEIGHT > height
            ? target.y - TOOLTIP_OFFSET - TOOLTIP_HEIGHT
            : target.y + TOOLTIP_OFFSET;

    return (
        <div
            aria-hidden
            className="pointer-events-none absolute z-20 flex max-w-60 flex-col gap-0.5 rounded-md border bg-popover px-3 py-2 text-popover-foreground text-xs shadow-md"
            style={{ left: Math.max(left, 8), top: Math.max(top, 8) }}
        >
            {target.kind === "country" ? (
                <CountryTooltipBody scene={scene} shape={target.shape} />
            ) : (
                <NodeTooltipBody node={target.node} />
            )}
        </div>
    );
}

"use client";

import { IconChevronDown } from "@tabler/icons-react";
import { useTranslations } from "next-intl";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RouteLineKey } from "@/features/travel-explorer/components/travel-status";
import { TRAVEL_STATUSES } from "@/features/travel-explorer/constants/explorer.constants";
import {
    COUNTRY_FILLS,
    SEQUENTIAL_FILLS,
} from "@/features/travel-explorer/constants/map-style.constants";
import { useExplorerData } from "@/features/travel-explorer/hooks/use-explorer-data";
import { useExplorerFormat } from "@/features/travel-explorer/hooks/use-explorer-format";
import { useExplorerState } from "@/features/travel-explorer/hooks/use-explorer-state";
import type { MapScene } from "@/features/travel-explorer/utils/map-scene.utils";
import { useMediaQuery } from "@/hooks/use-media-query";

function Swatch({ fill, label }: { fill: string; label: string }) {
    return (
        <li className="flex items-center gap-2">
            <span
                aria-hidden
                className="size-3 shrink-0 rounded-[3px] border border-foreground/10"
                style={{ backgroundColor: fill }}
            />
            {label}
        </li>
    );
}

function LegendContent({ scene }: { scene: MapScene }) {
    const t = useTranslations("Explorer.map.legend");
    const tStatus = useTranslations("Explorer.statuses");
    const format = useExplorerFormat();
    const { officialById } = useExplorerData();
    const { selection } = useExplorerState();

    const focusName = scene.focusCountry ? format.countryName(scene.focusCountry) : "";
    const officialName = selection.official ? officialById.get(selection.official)?.fullName : null;
    let title = t("worldTitle");
    if (scene.mode === "inbound") {
        title = t("inboundTitle", { country: focusName });
    } else if (scene.mode === "outbound") {
        title = officialName
            ? t("officialTitle", { name: officialName })
            : t("outboundTitle", { country: focusName });
    }

    const { thresholds } = scene.scale;
    const steps = thresholds.map((threshold, index) => {
        const from = index === 0 ? 1 : thresholds[index - 1] + 1;
        return {
            fill: SEQUENTIAL_FILLS[Math.max(scene.scale.stepFor(threshold), 0)],
            label:
                from === threshold
                    ? format.number(threshold)
                    : `${format.number(from)}–${format.number(threshold)}`,
        };
    });
    const hasValues = scene.values.size > 0;
    const statusesShown = TRAVEL_STATUSES.filter((status) =>
        scene.segments.some((segment) => segment.status === status)
    );

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
                <p className="font-medium">{title}</p>
                {hasValues ? (
                    <div>
                        <div aria-hidden className="flex gap-0.5">
                            {steps.map((step) => (
                                <span
                                    className="h-2 flex-1 first:rounded-l-sm last:rounded-r-sm"
                                    key={step.label}
                                    style={{ backgroundColor: step.fill }}
                                />
                            ))}
                        </div>
                        <ol className="mt-1 flex gap-0.5 text-[10px] text-muted-foreground tabular-nums">
                            {steps.map((step) => (
                                <li className="flex-1 truncate" key={step.label}>
                                    {step.label}
                                </li>
                            ))}
                        </ol>
                    </div>
                ) : (
                    <p className="text-muted-foreground">{t("noTrips")}</p>
                )}
            </div>

            <ul className="flex flex-col gap-1 text-muted-foreground">
                {scene.focusCountry ? (
                    <Swatch fill={COUNTRY_FILLS.selected} label={t("selected")} />
                ) : (
                    <>
                        <Swatch fill={COUNTRY_FILLS.tracked} label={t("trackedNoTrips")} />
                        <Swatch fill={COUNTRY_FILLS.land} label={t("notTracked")} />
                    </>
                )}
            </ul>

            {statusesShown.length > 0 ? (
                <ul aria-label={t("routes")} className="flex flex-col gap-1 text-muted-foreground">
                    {statusesShown.map((status) => (
                        <li className="flex items-center gap-2" key={status}>
                            <RouteLineKey status={status} />
                            {tStatus(status)}
                        </li>
                    ))}
                </ul>
            ) : null}
        </div>
    );
}

/** Key for the map's shading and route textures; collapsible on phones to save space. */
export function MapLegend({
    scene,
    left,
    bottom,
}: {
    scene: MapScene;
    left: number;
    bottom: number;
}) {
    const t = useTranslations("Explorer.map.legend");
    const isTabletUp = useMediaQuery("(min-width: 768px)");

    if (isTabletUp) {
        return (
            <section
                aria-label={t("label")}
                className="absolute z-10 w-56 rounded-md border bg-background p-3 text-xs shadow-sm"
                style={{ bottom, left }}
            >
                <LegendContent scene={scene} />
            </section>
        );
    }

    return (
        <Collapsible
            className="absolute z-10 max-w-[calc(100%-5rem)] rounded-md border bg-background text-xs shadow-sm transition-[bottom] duration-300"
            style={{ bottom, left }}
        >
            <CollapsibleTrigger className="group flex w-full items-center gap-1.5 px-2.5 py-1.5 font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                {t("label")}
                <IconChevronDown
                    aria-hidden
                    className="size-3.5 transition-transform group-data-panel-open:rotate-180"
                />
            </CollapsibleTrigger>
            <CollapsibleContent className="w-56 px-3 pb-3">
                <LegendContent scene={scene} />
            </CollapsibleContent>
        </Collapsible>
    );
}

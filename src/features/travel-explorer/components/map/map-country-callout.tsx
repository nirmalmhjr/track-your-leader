"use client";

import { useTranslations } from "next-intl";

import { CountryFlag } from "@/components/shared/country-flag";
import { useExplorerData } from "@/features/travel-explorer/hooks/use-explorer-data";
import { useExplorerFormat } from "@/features/travel-explorer/hooks/use-explorer-format";
import type {
    CalloutLayout,
    MapCountryShape,
} from "@/features/travel-explorer/utils/map-geometry.utils";
import { summarizeTravel } from "@/features/travel-explorer/utils/travel-aggregates.utils";
import { cn } from "@/lib/utils";

interface MapCountryCalloutProps {
    height: number;
    layout: CalloutLayout;
    shape: MapCountryShape;
    width: number;
}

/**
 * Card pinned to the selected country. It sits just outside the country's outline with a
 * leader line to the capital (or the centre of untracked countries), so the flag stays visible.
 */
export function MapCountryCallout({ shape, layout, width, height }: MapCountryCalloutProps) {
    const t = useTranslations("Explorer.map.callout");
    const format = useExplorerFormat();
    const {
        countryByCode,
        matchingOfficialIds,
        officialsByCountry,
        recordsByDestination,
        recordsByOrigin,
    } = useExplorerData();

    const { reference } = shape;
    const [x, y] = layout.anchor;
    if (!reference || x < 0 || x > width || y < 0 || y > height) {
        return null;
    }

    const code = reference.alpha3;
    const tracked = countryByCode.get(code);
    const officialCount = (officialsByCountry.get(code) ?? []).filter((official) =>
        matchingOfficialIds.has(official.id)
    ).length;
    const { tripCount } = summarizeTravel(recordsByOrigin.get(code) ?? []);
    const { tripCount: visitCount } = summarizeTravel(recordsByDestination.get(code) ?? []);

    const facts = tracked
        ? [
              t("officials", { count: officialCount, countLabel: format.number(officialCount) }),
              t("trips", { count: tripCount, countLabel: format.number(tripCount) }),
          ]
        : [t("visits", { count: visitCount, countLabel: format.number(visitCount) })];
    const isAbove = layout.placement === "above";

    return (
        <div
            aria-hidden
            className="pointer-events-none absolute top-0 left-0 z-10"
            style={{ transform: `translate(${x}px, ${y}px)` }}
        >
            <span
                className={cn(
                    "absolute left-0 w-px -translate-x-1/2 bg-(--map-ink)/70",
                    isAbove ? "bottom-0" : "top-0"
                )}
                style={{ height: layout.offset }}
            />
            <div
                className={cn(
                    "fade-in zoom-in-95 absolute left-0 -translate-x-1/2 animate-in duration-200 motion-reduce:animate-none",
                    isAbove ? "slide-in-from-bottom-1" : "slide-in-from-top-1"
                )}
                style={isAbove ? { bottom: layout.offset } : { top: layout.offset }}
            >
                <div className="flex items-center gap-3 whitespace-nowrap rounded-lg border bg-popover py-2 pr-3.5 pl-2.5 text-popover-foreground shadow-lg">
                    <CountryFlag alpha2={reference.alpha2} className="rounded-[3px]" size="lg" />
                    <span className="flex flex-col gap-0.5 leading-tight">
                        <span className="font-semibold text-sm">{format.countryName(code)}</span>
                        <span className="text-[11px] text-muted-foreground">
                            {tracked?.capital.city ?? reference.subregion}
                        </span>
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                            {facts.join(" · ")}
                        </span>
                    </span>
                </div>
            </div>
            <span className="absolute -top-1.25 -left-1.25 size-2.5 rounded-full bg-(--map-ink) shadow-[0_0_0_3px_var(--map-halo),0_0_0_6px_color-mix(in_oklab,var(--map-ink)_25%,transparent)]" />
        </div>
    );
}

"use client";

import type { ZoomTransform } from "d3-zoom";
import { useTranslations } from "next-intl";

import { CountryFlag } from "@/components/shared/country-flag";
import { useExplorerData } from "@/features/travel-explorer/hooks/use-explorer-data";
import { useExplorerFormat } from "@/features/travel-explorer/hooks/use-explorer-format";
import {
    getCountryAnchor,
    type MapCountryShape,
} from "@/features/travel-explorer/utils/map-geometry.utils";

interface MapCountryCalloutProps {
    height: number;
    shape: MapCountryShape;
    transform: ZoomTransform;
    width: number;
}

/**
 * Pointer pinned to the selected country: at the capital for tracked countries (where routes
 * start) and at the centre of the main landmass otherwise.
 */
export function MapCountryCallout({ shape, transform, width, height }: MapCountryCalloutProps) {
    const t = useTranslations("Explorer.map");
    const format = useExplorerFormat();
    const { countryByCode, matchingOfficialIds, officialsByCountry } = useExplorerData();

    const { reference } = shape;
    if (!reference) {
        return null;
    }

    const tracked = countryByCode.get(reference.alpha3);
    const anchor = getCountryAnchor(shape, tracked?.capital.coordinates ?? null);
    const [x, y] = transform.apply([anchor[0], anchor[1]]);

    if (x < 0 || x > width || y < 0 || y > height) {
        return null;
    }

    const officialCount = (officialsByCountry.get(reference.alpha3) ?? []).filter((official) =>
        matchingOfficialIds.has(official.id)
    ).length;
    const details = tracked
        ? t("calloutTracked", {
              capital: tracked.capital.city,
              count: officialCount,
              countLabel: format.number(officialCount),
          })
        : reference.subregion;

    return (
        <div
            aria-hidden
            className="pointer-events-none absolute top-0 left-0 z-10"
            style={{ transform: `translate(${x}px, ${y}px)` }}
        >
            <div className="fade-in zoom-in-95 absolute bottom-0 left-0 flex -translate-x-1/2 animate-in flex-col items-center pb-1.5 duration-200 motion-reduce:animate-none">
                <div className="flex items-center gap-2 whitespace-nowrap rounded-md border bg-popover px-2.5 py-1.5 text-popover-foreground shadow-md">
                    <CountryFlag alpha2={reference.alpha2} size="md" />
                    <span className="flex flex-col leading-tight">
                        <span className="font-medium text-sm">
                            {format.countryName(reference.alpha3)}
                        </span>
                        <span className="text-[11px] text-muted-foreground">{details}</span>
                    </span>
                </div>
                <span className="h-2.5 w-px bg-(--map-ink)" />
            </div>
            <span className="absolute -top-[5px] -left-[5px] size-2.5 rounded-full bg-(--map-ink) ring-(--map-halo) ring-2" />
        </div>
    );
}

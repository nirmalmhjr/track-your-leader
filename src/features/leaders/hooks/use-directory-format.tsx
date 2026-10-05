"use client";

import { createContext, type ReactNode, use, useMemo } from "react";

import {
    type ExplorerFormat,
    useExplorerFormat,
} from "@/features/travel-explorer/hooks/use-explorer-format";
import type { Place } from "@/features/travel-explorer/types/travel.types";
import type { CountryCode } from "@/types/geo.types";

const CountryNamesContext = createContext<Readonly<Record<CountryCode, string>> | null>(null);

/** Shares the server's country names with the directory pages (see `buildCountryNames`). */
export function CountryNamesProvider({
    children,
    names,
}: {
    children: ReactNode;
    names: Readonly<Record<CountryCode, string>>;
}) {
    return <CountryNamesContext value={names}>{children}</CountryNamesContext>;
}

/**
 * The explorer's formatters, with country names taken from the server so server-rendered text
 * and the browser's hydration agree.
 *
 * @returns Formatting helpers bound to the active locale.
 */
export function useDirectoryFormat(): ExplorerFormat {
    const format = useExplorerFormat();
    const names = use(CountryNamesContext);

    return useMemo(() => {
        if (!names) {
            return format;
        }
        const countryName = (code: CountryCode): string => names[code] ?? format.countryName(code);
        return {
            ...format,
            countryName,
            placeName: (place: Place) =>
                place.precision === "country" ? countryName(place.countryCode) : place.city,
            placeWithCountry: (place: Place) =>
                place.precision === "country"
                    ? countryName(place.countryCode)
                    : `${place.city}, ${countryName(place.countryCode)}`,
        };
    }, [format, names]);
}

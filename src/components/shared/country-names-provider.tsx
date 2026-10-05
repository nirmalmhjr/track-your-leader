"use client";

import { createContext, type ReactNode } from "react";

import type { CountryCode } from "@/types/geo.types";

/** Country names resolved on the server; `null` where no server names are provided (the map). */
export const CountryNamesContext = createContext<Readonly<Record<CountryCode, string>> | null>(
    null
);

/**
 * Shares the server's country names (see `buildCountryNames`) with client components, so text
 * rendered on the server and in the browser matches.
 */
export function CountryNamesProvider({
    children,
    names,
}: {
    children: ReactNode;
    names: Readonly<Record<CountryCode, string>>;
}) {
    return <CountryNamesContext value={names}>{children}</CountryNamesContext>;
}

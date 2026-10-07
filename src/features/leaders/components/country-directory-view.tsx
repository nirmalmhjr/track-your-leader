"use client";

import { IconSearch } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useCallback, useDeferredValue, useState } from "react";

import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CountryPeople } from "@/features/leaders/components/country-people";
import { FormerOfficialsDirectory } from "@/features/leaders/components/former-officials-directory";
import { InOfficeDirectory } from "@/features/leaders/components/in-office-directory";
import {
    COUNTRY_TAB_PARAM,
    COUNTRY_TABS,
    COUNTRY_TABS_ANCHOR,
} from "@/features/leaders/constants/leaders.constants";
import type { CountryDirectory } from "@/features/leaders/types/leaders.types";
import { useTravelFormat } from "@/hooks/use-travel-format";
import { getCurrentPosition } from "@/lib/travel/officials.utils";
import { normalizeSearchText } from "@/lib/utils";
import type { Official } from "@/types/travel.types";

const tabParser = parseAsStringLiteral(COUNTRY_TABS)
    .withDefault("in-office")
    .withOptions({ history: "replace", scroll: false });

const matchesName = (official: Official, needle: string): boolean =>
    !needle || normalizeSearchText(official.fullName).includes(needle);

function TabCount({ value }: { value: number }) {
    const format = useTravelFormat();
    return <span className="text-muted-foreground tabular-nums">{format.number(value)}</span>;
}

/**
 * A country's officials, filterable by name, in three tabs: who holds office now, who held it
 * before, and everyone else on record. The open tab lives in the URL so it can be linked to.
 */
export function CountryDirectoryView({ directory }: { directory: CountryDirectory }) {
    const t = useTranslations("Leaders.country");
    const format = useTravelFormat();
    const [tab, setTab] = useQueryState(COUNTRY_TAB_PARAM, tabParser);
    const [query, setQuery] = useState("");
    const deferredQuery = useDeferredValue(query);
    const countryName = format.countryName(directory.country.code);

    const needle = normalizeSearchText(deferredQuery);
    const inOffice = directory.inOffice.filter((entry) => matchesName(entry.official, needle));
    const officials = directory.officials.filter((official) => matchesName(official, needle));
    const formerCount = officials.filter(
        (official) => getCurrentPosition(official) === null
    ).length;

    const handleTabChange = useCallback(
        (value: unknown) => {
            const next = COUNTRY_TABS.find((candidate) => candidate === value);
            if (next) {
                setTab(next);
            }
        },
        [setTab]
    );
    const handleQueryChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setQuery(event.target.value);
    }, []);
    const noMatch = t("noMatch", { query: deferredQuery.trim() });

    return (
        <Tabs
            className="scroll-mt-6 gap-5"
            id={COUNTRY_TABS_ANCHOR}
            onValueChange={handleTabChange}
            value={tab}
        >
            <div className="flex flex-wrap items-center justify-between gap-3">
                <TabsList
                    aria-label={t("tabs.label")}
                    className="max-w-full gap-1 overflow-x-auto overflow-y-hidden"
                >
                    <TabsTrigger value="in-office">
                        {t("tabs.inOffice")}
                        <TabCount value={inOffice.length} />
                    </TabsTrigger>
                    <TabsTrigger value="former">
                        {t("tabs.former")}
                        <TabCount value={formerCount} />
                    </TabsTrigger>
                    <TabsTrigger value="people">{t("tabs.people")}</TabsTrigger>
                </TabsList>
                <div className="relative w-full sm:max-w-xs">
                    <IconSearch
                        aria-hidden
                        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                        aria-label={t("filter")}
                        className="pl-8"
                        onChange={handleQueryChange}
                        placeholder={t("filter")}
                        type="search"
                        value={query}
                    />
                </div>
            </div>

            <TabsContent keepMounted value="in-office">
                <InOfficeDirectory
                    allEntries={directory.inOffice}
                    countryName={countryName}
                    entries={inOffice}
                    noMatchLabel={needle ? noMatch : null}
                />
            </TabsContent>

            <TabsContent keepMounted value="former">
                <FormerOfficialsDirectory
                    allOfficials={directory.officials}
                    countryName={countryName}
                    noMatchLabel={needle ? noMatch : null}
                    officials={officials}
                />
            </TabsContent>

            <TabsContent keepMounted value="people">
                <CountryPeople
                    code={directory.country.code}
                    countryName={countryName}
                    isActive={tab === "people"}
                    needle={needle}
                />
            </TabsContent>
        </Tabs>
    );
}

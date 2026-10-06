"use client";

import { IconSearch } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useCallback, useDeferredValue, useState } from "react";

import { ShowMoreButton } from "@/components/shared/show-more-button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CountryPeople } from "@/features/leaders/components/country-people";
import { FormerOfficialsDirectory } from "@/features/leaders/components/former-officials-directory";
import { LeaderCard } from "@/features/leaders/components/leader-card";
import { SectionHeading } from "@/features/leaders/components/section-heading";
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

/** Leader cards rendered per page. */
const CARD_PAGE_SIZE = 12;

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
    const [shownCards, setShownCards] = useState(CARD_PAGE_SIZE);
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
        setShownCards(CARD_PAGE_SIZE);
    }, []);
    const showMoreCards = useCallback(() => setShownCards((count) => count + CARD_PAGE_SIZE), []);
    const remainingCards = inOffice.length - shownCards;
    const noMatch = t("noMatch", { query: deferredQuery.trim() });

    return (
        <Tabs
            className="scroll-mt-6 gap-5"
            id={COUNTRY_TABS_ANCHOR}
            onValueChange={handleTabChange}
            value={tab}
        >
            <div className="flex flex-wrap items-center justify-between gap-3">
                <TabsList aria-label={t("tabs.label")} className="max-w-full overflow-x-auto">
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

            <TabsContent className="flex flex-col gap-4" keepMounted value="in-office">
                <SectionHeading
                    caption={t("inOfficeCaption")}
                    id="in-office"
                    title={t("inOfficeTitle")}
                />
                {inOffice.length === 0 ? (
                    <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground text-sm">
                        {needle ? noMatch : t("noneInOffice", { country: countryName })}
                    </p>
                ) : (
                    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {inOffice.slice(0, shownCards).map((entry) => (
                            <li key={entry.official.id}>
                                <LeaderCard entry={entry} />
                            </li>
                        ))}
                    </ul>
                )}
                {remainingCards > 0 ? (
                    <ShowMoreButton
                        label={t("showMoreLeaders", {
                            count: remainingCards,
                            countLabel: format.number(remainingCards),
                        })}
                        onShowMore={showMoreCards}
                        shownCount={shownCards}
                    />
                ) : null}
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

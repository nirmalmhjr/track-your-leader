"use client";

import { IconSearch } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { useCallback, useDeferredValue, useState } from "react";

import { ShowMoreButton } from "@/components/shared/show-more-button";
import { Input } from "@/components/ui/input";
import { FormerOfficialsDirectory } from "@/features/leaders/components/former-officials-directory";
import { LeaderCard } from "@/features/leaders/components/leader-card";
import { SectionHeading } from "@/features/leaders/components/section-heading";
import type { CountryDirectory } from "@/features/leaders/types/leaders.types";
import { useTravelFormat } from "@/hooks/use-travel-format";
import { normalizeSearchText } from "@/lib/utils";
import type { Official } from "@/types/travel.types";

/** Leader cards rendered per page. */
const CARD_PAGE_SIZE = 12;

const matchesName = (official: Official, needle: string): boolean =>
    !needle || normalizeSearchText(official.fullName).includes(needle);

/** A country's officials, filterable by name: who holds office now and who held it before. */
export function CountryDirectoryView({ directory }: { directory: CountryDirectory }) {
    const t = useTranslations("Leaders.country");
    const format = useTravelFormat();
    const [query, setQuery] = useState("");
    const deferredQuery = useDeferredValue(query);
    const [shownCards, setShownCards] = useState(CARD_PAGE_SIZE);
    const countryName = format.countryName(directory.country.code);

    const needle = normalizeSearchText(deferredQuery);
    const inOffice = directory.inOffice.filter((entry) => matchesName(entry.official, needle));
    const officials = directory.officials.filter((official) => matchesName(official, needle));

    const handleQueryChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setQuery(event.target.value);
        setShownCards(CARD_PAGE_SIZE);
    }, []);
    const showMoreCards = useCallback(() => setShownCards((count) => count + CARD_PAGE_SIZE), []);
    const remainingCards = inOffice.length - shownCards;
    const hasNoMatch = Boolean(needle) && officials.length === 0;

    return (
        <>
            <div className="relative max-w-sm">
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

            {hasNoMatch ? (
                <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground text-sm">
                    {t("noMatch", { query: deferredQuery.trim() })}
                </p>
            ) : (
                <>
                    <section aria-labelledby="in-office" className="flex flex-col gap-4">
                        <SectionHeading
                            caption={t("inOfficeCaption")}
                            id="in-office"
                            title={
                                <>
                                    {t("inOfficeTitle")}{" "}
                                    <span className="font-normal text-muted-foreground">
                                        {format.number(inOffice.length)}
                                    </span>
                                </>
                            }
                        />
                        {inOffice.length === 0 ? (
                            <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground text-sm">
                                {t("noneInOffice", { country: countryName })}
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
                    </section>

                    <FormerOfficialsDirectory
                        allOfficials={directory.officials}
                        countryName={countryName}
                        officials={officials}
                    />
                </>
            )}
        </>
    );
}

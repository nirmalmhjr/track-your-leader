"use client";

import { IconChevronRight } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useCallback, useMemo, useState } from "react";

import { ShowMoreButton } from "@/components/shared/show-more-button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useExplorerState } from "@/features/travel-explorer/hooks/use-explorer-state";
import { useHoverHighlight } from "@/features/travel-explorer/hooks/use-hover-highlight";
import { useTravelFormat } from "@/hooks/use-travel-format";
import {
    getHeldOfficeKeys,
    groupOffices,
    groupPastTermsByYear,
    type Office,
    type OfficeTerm,
} from "@/lib/travel/offices.utils";
import { OFFICE_GROUPS } from "@/lib/travel/travel.constants";
import { cn } from "@/lib/utils";
import { useExplorerUiStore } from "@/stores/explorer-ui-store";
import type { OfficeGroup, Official } from "@/types/travel.types";

/** Years rendered per page in the year-by-year view. */
const YEAR_PAGE_SIZE = 8;

/** "2019 – 2021", or a single year for a stint that started and ended in it. */
function useTermYears(term: OfficeTerm): string {
    const t = useTranslations("Explorer.official");
    const format = useTravelFormat();
    const { startDate, endDate } = term.position;

    const endYear = endDate ? format.year(endDate.slice(0, 4)) : "";
    if (!startDate) {
        return t("until", { date: endYear });
    }
    const startYear = format.year(startDate.slice(0, 4));
    return startYear === endYear ? endYear : `${startYear} – ${endYear}`;
}

interface TermButtonProps {
    children: ReactNode;
    className?: string;
    term: OfficeTerm;
}

/** A past term that opens the official's profile and highlights their routes while hovered. */
function TermButton({ term, className, children }: TermButtonProps) {
    const { selectOfficial } = useExplorerState();
    const setHoveredOfficialId = useExplorerUiStore((state) => state.setHoveredOfficialId);
    const { official } = term;
    const handleSelect = useCallback(() => selectOfficial(official), [selectOfficial, official]);
    const highlightHandlers = useHoverHighlight(setHoveredOfficialId, official.id);

    return (
        <button
            className={cn(
                "flex w-full items-center gap-3 text-left outline-none transition-colors hover:bg-accent/50 focus-visible:ring-3 focus-visible:ring-ring/50",
                className
            )}
            onClick={handleSelect}
            type="button"
            {...highlightHandlers}
        >
            {children}
        </button>
    );
}

/** One stop on an office's timeline of earlier holders. */
function TimelineTerm({ term }: { term: OfficeTerm }) {
    const years = useTermYears(term);

    return (
        <li className="relative">
            <span
                aria-hidden
                className="absolute top-1/2 -left-[3.5px] size-1.5 -translate-y-1/2 rounded-full border border-muted-foreground/70 bg-card"
            />
            <TermButton className="rounded-md py-1.5 pr-2 pl-3" term={term}>
                <span className="min-w-0 flex-1 truncate text-sm">{term.official.fullName}</span>
                <span className="shrink-0 text-muted-foreground text-xs tabular-nums">{years}</span>
            </TermButton>
        </li>
    );
}

/** An office that unfolds into everyone who held it before, most recent first. */
function OfficeHistory({ office }: { office: Office }) {
    const t = useTranslations("Explorer.country");
    const format = useTravelFormat();
    const formerCount = new Set(office.past.map((term) => term.official.id)).size;

    return (
        <li>
            <Collapsible>
                <CollapsibleTrigger className="group flex w-full items-center gap-3 px-3 py-2.5 text-left outline-none transition-colors hover:bg-accent/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset">
                    <span className="min-w-0 flex-1 text-[13px] leading-snug">{office.title}</span>
                    <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
                        {t("formerHolders", {
                            count: formerCount,
                            countLabel: format.number(formerCount),
                        })}
                    </span>
                    <IconChevronRight
                        aria-hidden
                        className="size-4 shrink-0 text-muted-foreground transition-transform group-data-panel-open:rotate-90"
                    />
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <ol className="mr-2 mb-2.5 ml-5 border-l">
                        {office.past.map((term) => (
                            <TimelineTerm key={term.position.id} term={term} />
                        ))}
                    </ol>
                </CollapsibleContent>
            </Collapsible>
        </li>
    );
}

const groupLabelKey = (group: OfficeGroup) =>
    group === "vacant" ? "country.noLongerHeld" : (`roleGroups.${group}` as const);

/** The past, office by office: every position with the people who held it before. */
export function FormerByPosition({
    allOfficials,
    officials,
}: {
    /** Every official of the country, so offices whose holder is filtered out stay "held". */
    allOfficials: readonly Official[];
    officials: readonly Official[];
}) {
    const t = useTranslations("Explorer");
    const offices = useMemo(
        () =>
            groupOffices(officials, getHeldOfficeKeys(allOfficials)).filter(
                (office) => office.past.length > 0
            ),
        [allOfficials, officials]
    );

    return (
        <div className="flex flex-col gap-4">
            {OFFICE_GROUPS.map((group) => {
                const officesInGroup = offices.filter((office) => office.group === group);
                if (officesInGroup.length === 0) {
                    return null;
                }
                const label = t(groupLabelKey(group));
                return (
                    <section aria-label={label} className="flex flex-col gap-2" key={group}>
                        <h3 className="font-medium text-muted-foreground text-xs">{label}</h3>
                        <ul className="divide-y overflow-hidden rounded-lg border bg-card">
                            {officesInGroup.map((office) => (
                                <OfficeHistory key={office.key} office={office} />
                            ))}
                        </ul>
                    </section>
                );
            })}
        </div>
    );
}

/** A finished term in the year-by-year view: who, which office, and when. */
function YearTerm({ term }: { term: OfficeTerm }) {
    const years = useTermYears(term);

    return (
        <li>
            <TermButton className="px-3 py-2" term={term}>
                <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium text-sm">{term.official.fullName}</span>
                    <span className="truncate text-muted-foreground text-xs">
                        {term.position.title}
                    </span>
                </span>
                <span className="shrink-0 text-muted-foreground text-xs tabular-nums">{years}</span>
            </TermButton>
        </li>
    );
}

/** The past, year by year: who left which office in each year, newest first. */
export function FormerByYear({ officials }: { officials: readonly Official[] }) {
    const t = useTranslations("Explorer.country");
    const format = useTravelFormat();
    const years = useMemo(() => groupPastTermsByYear(officials), [officials]);
    const [limit, setLimit] = useState(YEAR_PAGE_SIZE);
    const showMore = useCallback(() => setLimit((current) => current + YEAR_PAGE_SIZE), []);

    const hiddenCount = Math.max(years.length - limit, 0);
    const nextCount = Math.min(hiddenCount, YEAR_PAGE_SIZE);

    return (
        <div className="flex flex-col gap-4">
            {years.slice(0, limit).map(({ year, terms }) => (
                <section aria-label={format.year(year)} className="flex flex-col" key={year}>
                    <h3 className="sticky top-0 z-10 -mx-1 bg-sidebar/95 px-1 py-1.5 font-semibold text-sm tabular-nums backdrop-blur-sm">
                        {format.year(year)}
                    </h3>
                    <ul className="divide-y overflow-hidden rounded-lg border bg-card">
                        {terms.map((term) => (
                            <YearTerm key={term.position.id} term={term} />
                        ))}
                    </ul>
                </section>
            ))}

            {hiddenCount > 0 ? (
                <ShowMoreButton
                    label={t("showMoreYears", {
                        count: nextCount,
                        countLabel: format.number(nextCount),
                    })}
                    onShowMore={showMore}
                    shownCount={limit}
                />
            ) : null}
        </div>
    );
}

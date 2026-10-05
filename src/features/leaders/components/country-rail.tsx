"use client";

import { IconChevronDown, IconSearch } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CountryFlag } from "@/components/shared/country-flag";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useDirectoryFormat } from "@/features/leaders/hooks/use-directory-format";
import type { CountryListItem } from "@/features/leaders/types/leaders.types";
import { getCountryPath } from "@/features/leaders/utils/leaders-paths";
import { normalizeSearchText } from "@/features/travel-explorer/utils/filters.utils";
import { Link } from "@/i18n/navigation";
import { getCountryReference } from "@/lib/geo/country-reference";
import { getCountrySearchTerms } from "@/lib/geo/country-search-terms";
import { cn } from "@/lib/utils";
import type { CountryCode } from "@/types/geo.types";

const RAIL_SORTS = ["name", "officials", "trips"] as const;
type RailSort = (typeof RAIL_SORTS)[number];

interface RailRow extends CountryListItem {
    name: string;
    /** Position in the server's alphabetical order. */
    order: number;
    searchText: string;
}

interface CountryRailProps {
    /** Country whose page is showing; on phones the list then folds behind a toggle. */
    activeCode?: CountryCode;
    /** Countries in alphabetical order, sorted on the server so hydration sees the same list. */
    countries: readonly CountryListItem[];
}

/**
 * Every tracked country, searchable and sortable, linking to its directory page. It sits beside
 * the content on larger screens and folds into a "change country" toggle on phones.
 */
export function CountryRail({ countries, activeCode }: CountryRailProps) {
    const t = useTranslations("Leaders.rail");
    const format = useDirectoryFormat();
    const [query, setQuery] = useState("");
    const [sort, setSort] = useState<RailSort>("name");
    const [isOpenOnPhone, setOpenOnPhone] = useState(false);
    const activeRef = useRef<HTMLAnchorElement>(null);
    const listRef = useRef<HTMLElement>(null);

    const rows = useMemo<RailRow[]>(
        () =>
            countries.map((country, order) => {
                const name = format.countryName(country.code);
                return {
                    ...country,
                    name,
                    order,
                    searchText: normalizeSearchText(
                        [name, ...getCountrySearchTerms(country.code)].join(" ")
                    ),
                };
            }),
        [countries, format]
    );

    const visibleRows = useMemo(() => {
        const needle = normalizeSearchText(query);
        const matching = needle ? rows.filter((row) => row.searchText.includes(needle)) : rows;
        const byName = (a: RailRow, b: RailRow) => a.order - b.order;
        if (sort === "officials") {
            return matching.toSorted((a, b) => b.officialCount - a.officialCount || byName(a, b));
        }
        if (sort === "trips") {
            return matching.toSorted((a, b) => b.tripCount - a.tripCount || byName(a, b));
        }
        return matching.toSorted(byName);
    }, [query, rows, sort]);

    // Bring the open country into view, so a long list never hides where you are. Only the list
    // scrolls: `scrollIntoView` would also move the page and the header with it.
    useEffect(() => {
        const list = listRef.current;
        const active = activeRef.current;
        if (list && active) {
            list.scrollTop = active.offsetTop - (list.clientHeight - active.offsetHeight) / 2;
        }
    }, []);

    const handleQueryChange = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => setQuery(event.target.value),
        []
    );
    const handleSortChange = useCallback((values: string[]) => {
        const next = RAIL_SORTS.find((candidate) => candidate === values[0]);
        if (next) {
            setSort(next);
        }
    }, []);
    const togglePhoneList = useCallback(() => setOpenOnPhone((isOpen) => !isOpen), []);

    const activeReference = activeCode ? getCountryReference(activeCode) : undefined;
    const isListHiddenOnPhone = Boolean(activeCode) && !isOpenOnPhone;

    return (
        <aside
            aria-label={t("label")}
            className="flex flex-col border-b bg-sidebar/60 md:sticky md:top-0 md:h-[calc(100dvh-3.5rem)] md:w-72 md:shrink-0 md:border-r md:border-b-0 lg:w-80"
        >
            {activeCode ? (
                <div className="p-3 md:hidden">
                    <Button
                        aria-expanded={isOpenOnPhone}
                        className="w-full justify-between"
                        onClick={togglePhoneList}
                        variant="outline"
                    >
                        <span className="flex min-w-0 items-center gap-2">
                            <CountryFlag alpha2={activeReference?.alpha2} size="sm" />
                            <span className="truncate">{format.countryName(activeCode)}</span>
                        </span>
                        <span className="flex items-center gap-1 text-muted-foreground text-xs">
                            {t("change")}
                            <IconChevronDown
                                aria-hidden
                                className={cn(
                                    "transition-transform",
                                    isOpenOnPhone && "rotate-180"
                                )}
                            />
                        </span>
                    </Button>
                </div>
            ) : null}

            <div
                className={cn(
                    "flex min-h-0 flex-1 flex-col",
                    isListHiddenOnPhone && "hidden md:flex"
                )}
            >
                <div className="flex flex-col gap-2 border-b p-3">
                    <div className="relative">
                        <IconSearch
                            aria-hidden
                            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                        />
                        <Input
                            aria-label={t("search")}
                            className="pl-8"
                            onChange={handleQueryChange}
                            placeholder={t("search")}
                            type="search"
                            value={query}
                        />
                    </div>
                    <ToggleGroup
                        aria-label={t("sortLabel")}
                        className="w-full"
                        onValueChange={handleSortChange}
                        size="sm"
                        spacing={0}
                        value={[sort]}
                        variant="outline"
                    >
                        {RAIL_SORTS.map((value) => (
                            <ToggleGroupItem
                                className="flex-1 text-muted-foreground text-xs data-pressed:bg-muted data-pressed:text-foreground"
                                key={value}
                                value={value}
                            >
                                {t(`sort.${value}`)}
                            </ToggleGroupItem>
                        ))}
                    </ToggleGroup>
                </div>

                <nav
                    aria-label={t("label")}
                    className="relative max-h-[60dvh] min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5 md:max-h-none"
                    ref={listRef}
                >
                    {visibleRows.length === 0 ? (
                        <p className="px-3 py-6 text-center text-muted-foreground text-sm">
                            {t("empty")}
                        </p>
                    ) : (
                        <ul className="flex flex-col gap-px">
                            {visibleRows.map((row) => {
                                const isActive = row.code === activeCode;
                                const figure = sort === "trips" ? row.tripCount : row.officialCount;
                                return (
                                    <li key={row.code}>
                                        <Link
                                            aria-current={isActive ? "page" : undefined}
                                            className={cn(
                                                "relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm outline-none transition-colors hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/50",
                                                isActive &&
                                                    "bg-muted font-medium before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-primary"
                                            )}
                                            href={getCountryPath(row.code)}
                                            ref={isActive ? activeRef : undefined}
                                        >
                                            <CountryFlag
                                                alpha2={getCountryReference(row.code)?.alpha2}
                                                size="md"
                                            />
                                            <span className="min-w-0 flex-1 truncate">
                                                {row.name}
                                            </span>
                                            <span
                                                className="shrink-0 text-muted-foreground text-xs tabular-nums"
                                                title={
                                                    sort === "trips"
                                                        ? t("trips", {
                                                              count: row.tripCount,
                                                              countLabel: format.number(
                                                                  row.tripCount
                                                              ),
                                                          })
                                                        : t("officials", {
                                                              count: row.officialCount,
                                                              countLabel: format.number(
                                                                  row.officialCount
                                                              ),
                                                          })
                                                }
                                            >
                                                {format.number(figure)}
                                            </span>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </nav>
            </div>
        </aside>
    );
}

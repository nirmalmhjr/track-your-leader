"use client";

import { Autocomplete } from "@base-ui/react/autocomplete";
import { IconSearch } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";

import { CountryFlag } from "@/components/shared/country-flag";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { useTravelFormat } from "@/hooks/use-travel-format";
import { getCountryReference } from "@/lib/geo/country-reference";
import { type SearchEntry, searchCountriesAndPeople } from "@/lib/travel/search.utils";
import type { SearchCountry, SearchPerson } from "@/types/travel.types";

export type SearchPeopleStatus = "loading" | "ready" | "error";

type SearchItem =
    | { country: SearchCountry; id: string; kind: "country" }
    | { id: string; kind: "person"; person: SearchPerson };

interface SearchGroup {
    items: SearchItem[];
    value: string;
}

const RESULT_ROW_CLASS =
    "flex cursor-default select-none items-center gap-3 rounded-sm px-2 py-1.5 text-sm outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground";

const getItemLabel = (item: SearchItem): string =>
    item.kind === "country" ? item.country.label : item.person.fullName;

const toCountryItem = (country: SearchCountry): SearchItem => ({
    country,
    id: `country-${country.code}`,
    kind: "country",
});

const toPersonItem = (person: SearchPerson): SearchItem => ({
    id: `person-${person.countryCode}-${person.id}`,
    kind: "person",
    person,
});

const isEditableTarget = (target: EventTarget | null): boolean =>
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName));

function PersonDetails({ person }: { person: SearchPerson }) {
    const t = useTranslations("Explorer.search");
    const format = useTravelFormat();

    return (
        <>
            <CountryFlag alpha2={getCountryReference(person.countryCode)?.alpha2} />
            <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate">{person.fullName}</span>
                <span className="truncate text-muted-foreground text-xs">
                    {person.title} · {format.countryName(person.countryCode)}
                </span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
                {person.tripCount > 0 ? (
                    <span className="text-muted-foreground text-xs tabular-nums">
                        {t("trips", {
                            count: person.tripCount,
                            countLabel: format.number(person.tripCount),
                        })}
                    </span>
                ) : null}
                {person.isCurrent ? (
                    <Badge className="border-transparent bg-travel-completed/15 text-travel-completed">
                        {t("inOffice")}
                    </Badge>
                ) : (
                    <Badge className="text-muted-foreground" variant="outline">
                        {t("former")}
                    </Badge>
                )}
            </span>
        </>
    );
}

function SearchResult({
    item,
    onChoose,
}: {
    item: SearchItem;
    onChoose: (item: SearchItem) => void;
}) {
    const handleClick = useCallback(() => onChoose(item), [onChoose, item]);

    return (
        <Autocomplete.Item className={RESULT_ROW_CLASS} onClick={handleClick} value={item}>
            {item.kind === "country" ? (
                <>
                    <CountryFlag alpha2={item.country.alpha2} />
                    <span className="flex min-w-0 flex-col">
                        <span className="truncate">{item.country.label}</span>
                        <span className="truncate text-muted-foreground text-xs">
                            {item.country.detail}
                        </span>
                    </span>
                </>
            ) : (
                <PersonDetails person={item.person} />
            )}
        </Autocomplete.Item>
    );
}

/** What the list says about people when it can't show them: too short a query, or not loaded. */
function PeopleNotice({
    onRetry,
    status,
}: {
    onRetry: (() => void) | undefined;
    status: SearchPeopleStatus | "short-query";
}) {
    const t = useTranslations("Explorer.search");

    if (status === "ready") {
        return null;
    }
    return (
        <div
            className="flex items-center gap-2 px-3 py-2 text-muted-foreground text-xs"
            role="status"
        >
            {status === "short-query" ? t("peopleHint") : null}
            {status === "loading" ? (
                <>
                    <Spinner aria-hidden className="size-3.5" />
                    {t("peopleLoading")}
                </>
            ) : null}
            {status === "error" ? (
                <>
                    {t("peopleError")}
                    {onRetry ? (
                        <Button onClick={onRetry} size="xs" variant="outline">
                            {t("retry")}
                        </Button>
                    ) : null}
                </>
            ) : null}
        </div>
    );
}

interface SiteSearchProps {
    countries: readonly SearchEntry<SearchCountry>[];
    onChooseCountry: (country: SearchCountry) => void;
    onChoosePerson: (person: SearchPerson) => void;
    /** Called when the search is about to be used (its button hovered or focused, or opened). */
    onPrepare?: () => void;
    onRetryPeople?: () => void;
    people: readonly SearchEntry<SearchPerson>[];
    peopleStatus: SearchPeopleStatus;
}

/**
 * Command-style search over countries and people, opened with ⌘K or "/". Countries match by
 * their name in the current language, their English name or their ISO code ("USA"); people by
 * their name, title or country. People are listed only from two characters on and at most a few
 * at a time, so a short query never fills the list with unrelated names.
 */
export function SiteSearch({
    countries,
    onChooseCountry,
    onChoosePerson,
    onPrepare,
    onRetryPeople,
    people,
    peopleStatus,
}: SiteSearchProps) {
    const t = useTranslations("Explorer.search");
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");
    // Typing stays responsive: results catch up with the input instead of blocking it.
    const deferredQuery = useDeferredValue(query);

    const handleOpenChange = useCallback(
        (open: boolean) => {
            setIsOpen(open);
            if (open) {
                onPrepare?.();
            } else {
                setQuery("");
            }
        },
        [onPrepare]
    );

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const isShortcut = event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey);
            const isSlash = event.key === "/" && !isEditableTarget(event.target);
            if (isShortcut || isSlash) {
                event.preventDefault();
                handleOpenChange(true);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleOpenChange]);

    const results = useMemo(
        () =>
            searchCountriesAndPeople(
                countries,
                peopleStatus === "ready" ? people : null,
                deferredQuery
            ),
        [countries, people, peopleStatus, deferredQuery]
    );

    const groups = useMemo((): SearchGroup[] => {
        const countryGroup = { items: results.countries.map(toCountryItem), value: t("countries") };
        const peopleGroup = { items: results.people.map(toPersonItem), value: t("people") };
        const ordered = results.peopleFirst
            ? [peopleGroup, countryGroup]
            : [countryGroup, peopleGroup];
        return ordered.filter((group) => group.items.length > 0);
    }, [results, t]);

    let peopleNotice: SearchPeopleStatus | "short-query" = "ready";
    if (deferredQuery.trim() && !results.searchesPeople) {
        peopleNotice = "short-query";
    } else if (results.searchesPeople) {
        peopleNotice = peopleStatus;
    }

    const choose = useCallback(
        (item: SearchItem) => {
            if (item.kind === "country") {
                onChooseCountry(item.country);
            } else {
                onChoosePerson(item.person);
            }
            handleOpenChange(false);
        },
        [handleOpenChange, onChooseCountry, onChoosePerson]
    );

    return (
        <Dialog onOpenChange={handleOpenChange} open={isOpen}>
            <DialogTrigger
                onFocus={onPrepare}
                onPointerEnter={onPrepare}
                render={
                    <Button
                        aria-label={t("open")}
                        className="w-9 justify-start text-muted-foreground sm:w-64"
                        size="sm"
                        variant="outline"
                    />
                }
            >
                <IconSearch data-icon="inline-start" />
                <span className="hidden flex-1 text-left sm:inline">{t("placeholderShort")}</span>
                <Kbd className="hidden sm:inline-flex">⌘K</Kbd>
            </DialogTrigger>
            <DialogContent
                className="top-[12%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg"
                showCloseButton={false}
            >
                <DialogTitle className="sr-only">{t("title")}</DialogTitle>
                <Autocomplete.Root
                    autoHighlight="always"
                    filter={null}
                    inline
                    items={groups}
                    itemToStringValue={getItemLabel}
                    keepHighlight
                    onValueChange={setQuery}
                    open
                    value={query}
                >
                    <div className="flex items-center gap-2 border-b px-3">
                        <IconSearch aria-hidden className="size-4 text-muted-foreground" />
                        <Autocomplete.Input
                            aria-label={t("title")}
                            className="h-12 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-sm"
                            placeholder={t("placeholder")}
                        />
                    </div>
                    <Autocomplete.Empty className="px-4 py-8 text-center text-muted-foreground text-sm empty:hidden">
                        {peopleNotice === "loading" ? null : t("empty")}
                    </Autocomplete.Empty>
                    <Autocomplete.List className="max-h-[min(60vh,26rem)] overflow-y-auto overscroll-contain p-1 data-empty:p-0">
                        {(group: SearchGroup) => (
                            <Autocomplete.Group
                                className="pb-1"
                                items={group.items}
                                key={group.value}
                            >
                                <Autocomplete.GroupLabel className="px-2 py-1.5 font-medium text-muted-foreground text-xs">
                                    {group.value}
                                </Autocomplete.GroupLabel>
                                <Autocomplete.Collection>
                                    {(item: SearchItem) => (
                                        <SearchResult item={item} key={item.id} onChoose={choose} />
                                    )}
                                </Autocomplete.Collection>
                            </Autocomplete.Group>
                        )}
                    </Autocomplete.List>
                    <PeopleNotice onRetry={onRetryPeople} status={peopleNotice} />
                    <p className="flex items-center gap-3 border-t px-3 py-2 text-muted-foreground text-xs">
                        <span className="flex items-center gap-1">
                            <Kbd>↑</Kbd>
                            <Kbd>↓</Kbd>
                            {t("navigate")}
                        </span>
                        <span className="flex items-center gap-1">
                            <Kbd>↵</Kbd>
                            {t("select")}
                        </span>
                        <span className="flex items-center gap-1">
                            <Kbd>Esc</Kbd>
                            {t("close")}
                        </span>
                    </p>
                </Autocomplete.Root>
            </DialogContent>
        </Dialog>
    );
}

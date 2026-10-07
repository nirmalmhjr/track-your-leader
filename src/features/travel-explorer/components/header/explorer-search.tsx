"use client";

import { Autocomplete } from "@base-ui/react/autocomplete";
import { IconSearch } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";

import { CountryFlag } from "@/components/shared/country-flag";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { useExplorerData } from "@/features/travel-explorer/hooks/use-explorer-data";
import { useOpenCountry } from "@/features/travel-explorer/hooks/use-open-country";
import { createSearchEntry, searchEntries } from "@/features/travel-explorer/utils/search.utils";
import { useTravelFormat } from "@/hooks/use-travel-format";
import { ALL_COUNTRY_REFERENCES } from "@/lib/geo/country-reference";
import { getCountrySearchTerms } from "@/lib/geo/country-search-terms";
import type { CountryCode } from "@/types/geo.types";

interface CountryItem {
    alpha2: string;
    code: CountryCode;
    detail: string;
    id: string;
    label: string;
}

interface SearchGroup {
    items: CountryItem[];
    value: string;
}

/** Every matching country is listed; there are only about 250. */
const RESULT_LIMIT = Number.POSITIVE_INFINITY;

const getItemLabel = (item: CountryItem): string => item.label;

function SearchResult({
    item,
    onChoose,
}: {
    item: CountryItem;
    onChoose: (item: CountryItem) => void;
}) {
    const handleClick = useCallback(() => onChoose(item), [onChoose, item]);

    return (
        <Autocomplete.Item
            className="flex cursor-default select-none items-center gap-3 rounded-sm px-2 py-1.5 text-sm outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
            onClick={handleClick}
            value={item}
        >
            <CountryFlag alpha2={item.alpha2} />
            <span className="flex min-w-0 flex-col">
                <span className="truncate">{item.label}</span>
                <span className="truncate text-muted-foreground text-xs">{item.detail}</span>
            </span>
        </Autocomplete.Item>
    );
}

const isEditableTarget = (target: EventTarget | null): boolean =>
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName));

/**
 * Command-style country search, opened with ⌘K or "/". Countries match by their name in the
 * current language, their English name or their ISO code ("USA"); people are found from a
 * country's panel instead, so a short query never fills the list with unrelated names.
 */
export function ExplorerSearch() {
    const t = useTranslations("Explorer.search");
    const format = useTravelFormat();
    const { countryByCode } = useExplorerData();
    const openCountry = useOpenCountry();
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");
    // Typing stays responsive: results catch up with the input instead of blocking it.
    const deferredQuery = useDeferredValue(query);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const isShortcut = event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey);
            const isSlash = event.key === "/" && !isEditableTarget(event.target);
            if (isShortcut || isSlash) {
                event.preventDefault();
                setIsOpen(true);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    const entries = useMemo(
        () =>
            ALL_COUNTRY_REFERENCES.filter((reference) => reference.region !== "Antarctic")
                .map((reference) => {
                    const label = format.countryName(reference.alpha3);
                    const isTracked = countryByCode.has(reference.alpha3);
                    const item: CountryItem = {
                        alpha2: reference.alpha2,
                        code: reference.alpha3,
                        detail: reference.subregion,
                        id: `country-${reference.alpha3}`,
                        label,
                    };
                    return createSearchEntry(item, label, getCountrySearchTerms(reference.alpha3), {
                        isCurrent: isTracked,
                    });
                })
                .sort((a, b) => a.item.label.localeCompare(b.item.label)),
        [countryByCode, format]
    );

    const groups = useMemo((): SearchGroup[] => {
        const items = deferredQuery.trim()
            ? searchEntries(entries, deferredQuery, RESULT_LIMIT)
            : entries.map((entry) => entry.item);
        return items.length > 0 ? [{ items, value: t("countries") }] : [];
    }, [deferredQuery, entries, t]);

    const handleOpenChange = useCallback((open: boolean) => {
        setIsOpen(open);
        if (!open) {
            setQuery("");
        }
    }, []);

    const choose = useCallback(
        (item: CountryItem) => {
            openCountry(item.code, countryByCode.has(item.code) ? "officials" : "inbound");
            handleOpenChange(false);
        },
        [countryByCode, handleOpenChange, openCountry]
    );

    return (
        <Dialog onOpenChange={handleOpenChange} open={isOpen}>
            <DialogTrigger
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
                        {t("empty")}
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
                                    {(item: CountryItem) => (
                                        <SearchResult item={item} key={item.id} onChoose={choose} />
                                    )}
                                </Autocomplete.Collection>
                            </Autocomplete.Group>
                        )}
                    </Autocomplete.List>
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

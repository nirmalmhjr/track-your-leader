"use client";

import { Autocomplete } from "@base-ui/react/autocomplete";
import { IconSearch } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { CountryFlag } from "@/components/shared/country-flag";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { OfficialAvatar } from "@/features/travel-explorer/components/official-avatar";
import { useExplorerData } from "@/features/travel-explorer/hooks/use-explorer-data";
import { useExplorerFormat } from "@/features/travel-explorer/hooks/use-explorer-format";
import { useExplorerState } from "@/features/travel-explorer/hooks/use-explorer-state";
import type { Official } from "@/features/travel-explorer/types/travel.types";
import {
    getCurrentPosition,
    getPrimaryPosition,
    normalizeSearchText,
} from "@/features/travel-explorer/utils/filters.utils";
import { ALL_COUNTRY_REFERENCES } from "@/lib/geo/country-reference";
import type { CountryCode } from "@/types/geo.types";

type SearchItem =
    | {
          kind: "country";
          id: string;
          label: string;
          detail: string;
          searchText: string;
          code: CountryCode;
          alpha2: string;
      }
    | {
          kind: "official";
          id: string;
          label: string;
          detail: string;
          searchText: string;
          official: Official;
      };

interface SearchGroup {
    items: SearchItem[];
    value: string;
}

const matchesSearch = (item: SearchItem, query: string): boolean =>
    item.searchText.includes(normalizeSearchText(query));

const getItemLabel = (item: SearchItem): string => item.label;

function SearchResult({
    item,
    onChoose,
}: {
    item: SearchItem;
    onChoose: (item: SearchItem) => void;
}) {
    const handleClick = useCallback(() => onChoose(item), [onChoose, item]);

    return (
        <Autocomplete.Item
            className="flex cursor-default select-none items-center gap-3 rounded-sm px-2 py-1.5 text-sm outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
            onClick={handleClick}
            value={item}
        >
            {item.kind === "country" ? (
                <CountryFlag alpha2={item.alpha2} />
            ) : (
                <OfficialAvatar official={item.official} size="sm" />
            )}
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

/** Command-style search across every country and official, opened with ⌘K or "/". */
export function ExplorerSearch() {
    const t = useTranslations("Explorer.search");
    const format = useExplorerFormat();
    const { allOfficials, countryByCode } = useExplorerData();
    const { selectCountry, selectOfficial } = useExplorerState();
    const [isOpen, setIsOpen] = useState(false);

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

    const countryItems: SearchItem[] = ALL_COUNTRY_REFERENCES.filter(
        (reference) => reference.region !== "Antarctic"
    )
        .map((reference) => {
            const label = format.countryName(reference.alpha3);
            const isTracked = countryByCode.has(reference.alpha3);
            return {
                alpha2: reference.alpha2,
                code: reference.alpha3,
                detail: isTracked ? t("tracked") : reference.subregion,
                id: `country-${reference.alpha3}`,
                kind: "country" as const,
                label,
                searchText: normalizeSearchText(`${label} ${reference.name} ${reference.alpha3}`),
            };
        })
        .sort(
            (a, b) =>
                Number(countryByCode.has(b.code)) - Number(countryByCode.has(a.code)) ||
                a.label.localeCompare(b.label)
        );

    const officialItems: SearchItem[] = allOfficials.map((official) => {
        const position = getPrimaryPosition(official);
        const title = getCurrentPosition(official)
            ? position.title
            : t("former", { title: position.title });
        return {
            detail: `${title} · ${format.countryName(official.countryCode)}`,
            id: `official-${official.id}`,
            kind: "official" as const,
            label: official.fullName,
            official,
            searchText: normalizeSearchText(
                `${official.fullName} ${position.title} ${format.countryName(official.countryCode)}`
            ),
        };
    });

    const groups: SearchGroup[] = [
        { items: officialItems, value: t("officials") },
        { items: countryItems, value: t("countries") },
    ];

    const choose = useCallback(
        (item: SearchItem) => {
            if (item.kind === "country") {
                selectCountry(item.code, countryByCode.has(item.code) ? "officials" : "inbound");
            } else {
                selectOfficial(item.official);
            }
            setIsOpen(false);
        },
        [countryByCode, selectCountry, selectOfficial]
    );

    return (
        <Dialog onOpenChange={setIsOpen} open={isOpen}>
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
                    filter={matchesSearch}
                    inline
                    items={groups}
                    itemToStringValue={getItemLabel}
                    keepHighlight
                    open
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
                                    {(item: SearchItem) => (
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

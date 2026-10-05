"use client";

import { useTranslations } from "next-intl";
import { useCallback, useId, useMemo } from "react";

import { CountryFlag } from "@/components/shared/country-flag";
import {
    Combobox,
    ComboboxChip,
    ComboboxChips,
    ComboboxChipsInput,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxItem,
    ComboboxList,
    ComboboxValue,
    useComboboxAnchor,
} from "@/components/ui/combobox";
import { Field, FieldLabel } from "@/components/ui/field";
import { useExplorerData } from "@/features/travel-explorer/hooks/use-explorer-data";
import { useExplorerState } from "@/features/travel-explorer/hooks/use-explorer-state";
import { useFilterSetter } from "@/features/travel-explorer/hooks/use-filter-setter";
import { useTravelFormat } from "@/hooks/use-travel-format";
import { getCountryReference } from "@/lib/geo/country-reference";
import type { CountryCode } from "@/types/geo.types";

interface CountryItem {
    label: string;
    value: CountryCode;
}

const isSameCountry = (item: CountryItem, value: CountryItem): boolean =>
    item.value === value.value;

/** Multi-select of visited countries, rendered as removable chips. */
export function DestinationCountryFilter() {
    const t = useTranslations("Explorer.filters");
    const format = useTravelFormat();
    const { filters } = useExplorerState();
    const setDestinations = useFilterSetter("destinations");
    const handleChange = useCallback(
        (values: CountryItem[]) => setDestinations(values.map((value) => value.value)),
        [setDestinations]
    );
    const anchor = useComboboxAnchor();
    const inputId = useId();

    const { allRecords } = useExplorerData();
    // Countries that appear as a destination anywhere in the data.
    const destinationCodes = useMemo(
        () => [...new Set(allRecords.map((record) => record.destination.countryCode))],
        [allRecords]
    );
    const items: CountryItem[] = destinationCodes
        .map((code) => ({ label: format.countryName(code), value: code }))
        .sort((a, b) => a.label.localeCompare(b.label));
    const selected = items.filter((item) => filters.destinations.includes(item.value));

    return (
        <Field>
            <FieldLabel htmlFor={inputId}>{t("countryVisited")}</FieldLabel>
            <Combobox
                isItemEqualToValue={isSameCountry}
                items={items}
                multiple
                onValueChange={handleChange}
                value={selected}
            >
                <ComboboxChips ref={anchor}>
                    <ComboboxValue>
                        {(values: CountryItem[]) =>
                            values.map((value) => (
                                <ComboboxChip key={value.value}>{value.label}</ComboboxChip>
                            ))
                        }
                    </ComboboxValue>
                    <ComboboxChipsInput
                        id={inputId}
                        placeholder={selected.length === 0 ? t("anyCountry") : undefined}
                    />
                </ComboboxChips>
                <ComboboxContent anchor={anchor}>
                    <ComboboxEmpty>{t("noCountryMatch")}</ComboboxEmpty>
                    <ComboboxList>
                        {(item: CountryItem) => (
                            <ComboboxItem key={item.value} value={item}>
                                <CountryFlag
                                    alpha2={getCountryReference(item.value)?.alpha2}
                                    size="sm"
                                />
                                {item.label}
                            </ComboboxItem>
                        )}
                    </ComboboxList>
                </ComboboxContent>
            </Combobox>
        </Field>
    );
}

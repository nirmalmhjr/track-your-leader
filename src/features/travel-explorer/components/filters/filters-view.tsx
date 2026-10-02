"use client";

import { IconSearch } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { type ChangeEvent, useCallback } from "react";

import { CountryFlag } from "@/components/shared/country-flag";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldGroup,
    FieldLabel,
    FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CheckboxOptionList } from "@/features/travel-explorer/components/filters/checkbox-option-list";
import {
    CalendarPeriodFields,
    CustomDateFields,
    DatePresetList,
} from "@/features/travel-explorer/components/filters/date-range-fields";
import { DestinationCountryFilter } from "@/features/travel-explorer/components/filters/destination-country-filter";
import { RouteLineKey } from "@/features/travel-explorer/components/travel-status";
import {
    DESTINATION_REGIONS,
    OFFICE_TENURES,
    PORTFOLIOS,
    ROLE_CATEGORIES,
    TRAVEL_STATUSES,
    TRAVEL_TYPES,
} from "@/features/travel-explorer/constants/explorer.constants";
import { useExplorerData } from "@/features/travel-explorer/hooks/use-explorer-data";
import { useExplorerFormat } from "@/features/travel-explorer/hooks/use-explorer-format";
import { useExplorerState } from "@/features/travel-explorer/hooks/use-explorer-state";
import { useFilterSetter } from "@/features/travel-explorer/hooks/use-filter-setter";
import { countActiveFilters } from "@/features/travel-explorer/utils/filters.utils";
import { getCountryReference } from "@/lib/geo/country-reference";
import { useExplorerUiStore } from "@/stores/explorer-ui-store";

const ANY_VALUE = "any";
const ALL_TENURES = "all";
const TENURE_OPTIONS = [ALL_TENURES, ...OFFICE_TENURES] as const;
const DEFAULT_OPEN_SECTIONS = ["dates", "person", "travel"];

function DateSection() {
    const t = useTranslations("Explorer.filters");

    return (
        <AccordionItem value="dates">
            <AccordionTrigger>{t("sections.dates")}</AccordionTrigger>
            <AccordionContent className="flex flex-col gap-4">
                <div className="-mx-2">
                    <DatePresetList />
                </div>
                <FieldSeparator>{t("orPickPeriod")}</FieldSeparator>
                <CalendarPeriodFields />
                <CustomDateFields />
            </AccordionContent>
        </AccordionItem>
    );
}

function OriginCountryField() {
    const t = useTranslations("Explorer.filters");
    const format = useExplorerFormat();
    const { countries } = useExplorerData();
    const { selection, selectCountry } = useExplorerState();

    const items = [
        { label: t("allCountries"), value: ANY_VALUE },
        ...countries
            .map((country) => ({ label: format.countryName(country.code), value: country.code }))
            .sort((a, b) => a.label.localeCompare(b.label)),
    ];
    const isTracked = countries.some((country) => country.code === selection.country);
    const handleOriginChange = useCallback(
        (value: string | null) => selectCountry(!value || value === ANY_VALUE ? null : value),
        [selectCountry]
    );

    return (
        <Field>
            <FieldLabel htmlFor="filter-origin">{t("originCountry")}</FieldLabel>
            <Select
                items={items}
                onValueChange={handleOriginChange}
                value={isTracked ? selection.country : ANY_VALUE}
            >
                <SelectTrigger className="w-full" id="filter-origin">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectGroup>
                        {items.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                                {item.value === ANY_VALUE ? null : (
                                    <CountryFlag
                                        alpha2={getCountryReference(item.value)?.alpha2}
                                        size="sm"
                                    />
                                )}
                                {item.label}
                            </SelectItem>
                        ))}
                    </SelectGroup>
                </SelectContent>
            </Select>
            <FieldDescription>{t("originCountryHint")}</FieldDescription>
        </Field>
    );
}

function PartyField() {
    const t = useTranslations("Explorer.filters");
    const { allOfficials } = useExplorerData();
    const { filters, selection } = useExplorerState();
    const setParty = useFilterSetter("party");

    const parties = [
        ...new Set(
            allOfficials
                .filter(
                    (official) => !selection.country || official.countryCode === selection.country
                )
                .flatMap((official) => (official.party ? [official.party] : []))
        ),
    ].sort((a, b) => a.localeCompare(b));

    const handlePartyChange = useCallback(
        (value: string | null) => setParty(!value || value === ANY_VALUE ? null : value),
        [setParty]
    );

    if (parties.length === 0) {
        return null;
    }

    const items = [
        { label: t("anyParty"), value: ANY_VALUE },
        ...parties.map((party) => ({ label: party, value: party })),
    ];

    return (
        <Field>
            <FieldLabel htmlFor="filter-party">{t("party")}</FieldLabel>
            <Select
                items={items}
                onValueChange={handlePartyChange}
                value={filters.party ?? ANY_VALUE}
            >
                <SelectTrigger className="w-full" id="filter-party">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectGroup>
                        {items.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                                {item.label}
                            </SelectItem>
                        ))}
                    </SelectGroup>
                </SelectContent>
            </Select>
        </Field>
    );
}

function PersonSection() {
    const t = useTranslations("Explorer");
    const { filters } = useExplorerState();
    const setName = useFilterSetter("name");
    const setTenure = useFilterSetter("tenure");
    const setRoles = useFilterSetter("roles");
    const setIncludePrevious = useFilterSetter("includePreviousPositions");
    const setPortfolios = useFilterSetter("portfolios");

    const handleNameChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => setName(event.target.value),
        [setName]
    );
    const handleTenureChange = useCallback(
        (values: string[]) =>
            setTenure(OFFICE_TENURES.find((tenure) => tenure === values[0]) ?? null),
        [setTenure]
    );

    return (
        <AccordionItem value="person">
            <AccordionTrigger>{t("filters.sections.person")}</AccordionTrigger>
            <AccordionContent>
                <FieldGroup className="gap-5">
                    <Field>
                        <FieldLabel htmlFor="filter-name">{t("filters.name")}</FieldLabel>
                        <InputGroup>
                            <InputGroupAddon>
                                <IconSearch aria-hidden />
                            </InputGroupAddon>
                            <InputGroupInput
                                autoComplete="off"
                                id="filter-name"
                                onChange={handleNameChange}
                                placeholder={t("filters.namePlaceholder")}
                                value={filters.name}
                            />
                        </InputGroup>
                    </Field>

                    <OriginCountryField />

                    <Field>
                        <FieldLabel id="filter-tenure-label">
                            {t("filters.officeStatus")}
                        </FieldLabel>
                        <ToggleGroup
                            aria-labelledby="filter-tenure-label"
                            className="w-full"
                            onValueChange={handleTenureChange}
                            spacing={0}
                            value={[filters.tenure ?? ALL_TENURES]}
                            variant="outline"
                        >
                            {TENURE_OPTIONS.map((tenure) => (
                                <ToggleGroupItem className="flex-1" key={tenure} value={tenure}>
                                    {t(`tenure.${tenure}`)}
                                </ToggleGroupItem>
                            ))}
                        </ToggleGroup>
                    </Field>

                    <CheckboxOptionList
                        legend={t("filters.role")}
                        onChange={setRoles}
                        options={ROLE_CATEGORIES.map((role) => ({
                            label: t(`roles.${role}`),
                            value: role,
                        }))}
                        selected={filters.roles}
                    />

                    <Field orientation="horizontal">
                        <FieldContent>
                            <FieldLabel htmlFor="filter-previous">
                                {t("filters.includePrevious")}
                            </FieldLabel>
                            <FieldDescription>{t("filters.includePreviousHint")}</FieldDescription>
                        </FieldContent>
                        <Switch
                            checked={filters.includePreviousPositions}
                            id="filter-previous"
                            onCheckedChange={setIncludePrevious}
                        />
                    </Field>

                    <CheckboxOptionList
                        columns={2}
                        legend={t("filters.portfolio")}
                        onChange={setPortfolios}
                        options={PORTFOLIOS.map((portfolio) => ({
                            label: t(`portfolios.${portfolio}`),
                            value: portfolio,
                        }))}
                        selected={filters.portfolios}
                    />

                    <PartyField />
                </FieldGroup>
            </AccordionContent>
        </AccordionItem>
    );
}

function TravelSection() {
    const t = useTranslations("Explorer");
    const { filters } = useExplorerState();
    const setStatuses = useFilterSetter("statuses");
    const setTypes = useFilterSetter("types");

    return (
        <AccordionItem value="travel">
            <AccordionTrigger>{t("filters.sections.travel")}</AccordionTrigger>
            <AccordionContent>
                <FieldGroup className="gap-5">
                    <CheckboxOptionList
                        legend={t("filters.status")}
                        onChange={setStatuses}
                        options={TRAVEL_STATUSES.map((status) => ({
                            adornment: <RouteLineKey status={status} />,
                            label: t(`statuses.${status}`),
                            value: status,
                        }))}
                        selected={filters.statuses}
                    />
                    <CheckboxOptionList
                        legend={t("filters.travelType")}
                        onChange={setTypes}
                        options={TRAVEL_TYPES.map((type) => ({
                            label: t(`travelTypes.${type}`),
                            value: type,
                        }))}
                        selected={filters.types}
                    />
                </FieldGroup>
            </AccordionContent>
        </AccordionItem>
    );
}

function DestinationSection() {
    const t = useTranslations("Explorer");
    const { filters } = useExplorerState();
    const setRegions = useFilterSetter("regions");
    const setCity = useFilterSetter("city");
    const handleCityChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => setCity(event.target.value),
        [setCity]
    );

    return (
        <AccordionItem value="destination">
            <AccordionTrigger>{t("filters.sections.destination")}</AccordionTrigger>
            <AccordionContent>
                <FieldGroup className="gap-5">
                    <CheckboxOptionList
                        columns={2}
                        legend={t("filters.region")}
                        onChange={setRegions}
                        options={DESTINATION_REGIONS.map((region) => ({
                            label: t(`regions.${region}`),
                            value: region,
                        }))}
                        selected={filters.regions}
                    />
                    <DestinationCountryFilter />
                    <Field>
                        <FieldLabel htmlFor="filter-city">{t("filters.city")}</FieldLabel>
                        <Input
                            autoComplete="off"
                            id="filter-city"
                            onChange={handleCityChange}
                            placeholder={t("filters.cityPlaceholder")}
                            value={filters.city}
                        />
                    </Field>
                </FieldGroup>
            </AccordionContent>
        </AccordionItem>
    );
}

/**
 * Full filter editor. Sections are independent, so new filters slot into an existing section
 * (or a new one) without changing the surrounding layout.
 */
export function FiltersView() {
    const t = useTranslations("Explorer.filters");
    const format = useExplorerFormat();
    const { filters, resetFilters, selection } = useExplorerState();
    const { matchingRecords, recordsByDestination, recordsByOrigin } = useExplorerData();
    const setFiltersOpen = useExplorerUiStore((state) => state.setFiltersOpen);
    const closeFilters = useCallback(() => setFiltersOpen(false), [setFiltersOpen]);

    let scopedCount = matchingRecords.length;
    if (selection.country) {
        const scoped = selection.view === "inbound" ? recordsByDestination : recordsByOrigin;
        scopedCount = scoped.get(selection.country)?.length ?? 0;
    }

    return (
        <div className="flex min-h-full flex-col">
            <div className="flex-1 px-4">
                <Accordion defaultValue={DEFAULT_OPEN_SECTIONS} multiple>
                    <DateSection />
                    <PersonSection />
                    <TravelSection />
                    <DestinationSection />
                </Accordion>
            </div>
            <div className="sticky bottom-0 flex items-center gap-2 border-t bg-background px-4 py-3">
                <Button
                    disabled={countActiveFilters(filters) === 0}
                    onClick={resetFilters}
                    variant="ghost"
                >
                    {t("resetAll")}
                </Button>
                <Button className="flex-1" onClick={closeFilters}>
                    {t("showResults", {
                        count: scopedCount,
                        countLabel: format.number(scopedCount),
                    })}
                </Button>
            </div>
        </div>
    );
}

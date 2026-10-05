"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useCallback, useState } from "react";

import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ClearFiltersEmpty } from "@/features/travel-explorer/components/panel/clear-filters-empty";
import {
    FormerByPosition,
    FormerByYear,
} from "@/features/travel-explorer/components/panel/former-officials";
import { OfficialsList } from "@/features/travel-explorer/components/panel/officials-list";
import {
    FORMER_LAYOUTS,
    OFFICIAL_SORTS,
} from "@/features/travel-explorer/constants/explorer.constants";
import { useCountryOfficials } from "@/features/travel-explorer/hooks/use-country-officials";
import { useExplorerData } from "@/features/travel-explorer/hooks/use-explorer-data";
import type { OfficialSort } from "@/features/travel-explorer/types/explorer.types";
import { useTravelFormat } from "@/hooks/use-travel-format";
import { getCurrentPosition } from "@/lib/travel/officials.utils";
import { OFFICE_TENURES } from "@/lib/travel/travel.constants";
import { useExplorerUiStore } from "@/stores/explorer-ui-store";
import type { CountryCode } from "@/types/geo.types";
import type { OfficeTenure, Official } from "@/types/travel.types";

interface CompactSelectProps {
    items: readonly { label: string; value: string }[];
    label: string;
    onValueChange: (value: string | null) => void;
    value: string;
}

/** Small right-aligned select arranging the list below it. */
function CompactSelect({ items, label, onValueChange, value }: CompactSelectProps) {
    return (
        <Select items={items} onValueChange={onValueChange} value={value}>
            <SelectTrigger aria-label={label} size="sm">
                <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
                <SelectGroup>
                    {items.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                            {item.label}
                        </SelectItem>
                    ))}
                </SelectGroup>
            </SelectContent>
        </Select>
    );
}

const isInOffice = (official: Official): boolean => getCurrentPosition(official) !== null;

interface InOfficeListProps {
    countryCode: CountryCode;
    sort: OfficialSort;
    /** Everyone in office, whether or not they travelled. */
    total: number;
    /** Those in office whose trips match the trip filters. */
    travelling: readonly Official[];
}

/**
 * Officials in office, narrowed to those who travelled within the trip filters (by default the
 * last 30 days), saying so whenever that hides anyone.
 */
function InOfficeList({ countryCode, sort, total, travelling }: InOfficeListProps) {
    const t = useTranslations("Explorer.country");
    const format = useTravelFormat();
    const labels = {
        shownLabel: format.number(travelling.length),
        totalLabel: format.number(total),
    };

    if (travelling.length === 0) {
        return (
            <ClearFiltersEmpty
                description={t("inOfficeNoTripsDescription", labels)}
                title={t("inOfficeNoTripsTitle")}
            />
        );
    }

    return (
        <div className="flex flex-col gap-3">
            {travelling.length < total ? (
                <p className="text-muted-foreground text-xs">{t("inOfficeNarrowed", labels)}</p>
            ) : null}
            <OfficialsList countryCode={countryCode} officials={travelling} sort={sort} />
        </div>
    );
}

/**
 * The officials tab of a country. The in-office / former switch carries the counts, so it reads
 * as a summary and is also the way into the past, which can be laid out by office, year or person.
 * Mount it with `key={countryCode}` so every country opens on who is in office now.
 */
export function CountryOfficials({ countryCode }: { countryCode: CountryCode }) {
    const t = useTranslations("Explorer");
    const format = useTravelFormat();
    const { roster, travelling } = useCountryOfficials(countryCode);
    const { officialsByCountry } = useExplorerData();
    const formerLayout = useExplorerUiStore((state) => state.formerLayout);
    const setFormerLayout = useExplorerUiStore((state) => state.setFormerLayout);
    const [chosenTenure, setChosenTenure] = useState<OfficeTenure>("current");
    const [sort, setSort] = useState<OfficialSort>("rank");

    const handleTenureChange = useCallback((values: string[]) => {
        // Pressing the active side would leave nothing selected; keep it instead.
        const next = OFFICE_TENURES.find((candidate) => candidate === values[0]);
        if (next) {
            setChosenTenure(next);
        }
    }, []);
    const handleSortChange = useCallback((value: string | null) => {
        const next = OFFICIAL_SORTS.find((candidate) => candidate === value);
        if (next) {
            setSort(next);
        }
    }, []);
    const handleFormerLayoutChange = useCallback(
        (value: string | null) => {
            const next = FORMER_LAYOUTS.find((candidate) => candidate === value);
            if (next) {
                setFormerLayout(next);
            }
        },
        [setFormerLayout]
    );

    if (roster.length === 0) {
        return (
            <ClearFiltersEmpty
                description={t("country.noOfficialsDescription")}
                title={t("country.noOfficialsTitle")}
            />
        );
    }

    // The switch counts the roster: holding office does not depend on when anyone travelled.
    const current = roster.filter(isInOffice);
    const former = roster.filter((official) => !isInOffice(official));
    const travellingCurrent = travelling.filter(isInOffice);
    const counts: Record<OfficeTenure, number> = {
        current: current.length,
        former: former.length,
    };
    // An empty side (say, the tenure filter excludes it) gives way to the other one.
    const otherTenure: OfficeTenure = chosenTenure === "current" ? "former" : "current";
    const tenure = counts[chosenTenure] === 0 ? otherTenure : chosenTenure;

    const sortItems = OFFICIAL_SORTS.map((value) => ({ label: t(`sort.${value}`), value }));
    const layoutItems = FORMER_LAYOUTS.map((value) => ({
        label: t(`country.formerLayout.${value}`),
        value,
    }));

    let list: ReactNode;
    if (tenure === "current") {
        list = (
            <InOfficeList
                countryCode={countryCode}
                sort={sort}
                total={current.length}
                travelling={travellingCurrent}
            />
        );
    } else if (formerLayout === "position") {
        // Offices also list earlier stints of people who hold another office today.
        list = (
            <FormerByPosition
                allOfficials={officialsByCountry.get(countryCode) ?? []}
                officials={roster}
            />
        );
    } else if (formerLayout === "year") {
        list = <FormerByYear officials={roster} />;
    } else {
        list = <OfficialsList countryCode={countryCode} officials={former} sort="recent" />;
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
                <ToggleGroup
                    aria-label={t("country.tenureSwitch.label")}
                    onValueChange={handleTenureChange}
                    size="sm"
                    spacing={0}
                    value={[tenure]}
                    variant="outline"
                >
                    {OFFICE_TENURES.map((value) => (
                        <ToggleGroupItem
                            className="gap-1.5 px-3 text-muted-foreground data-pressed:bg-muted data-pressed:text-foreground"
                            disabled={counts[value] === 0}
                            key={value}
                            value={value}
                        >
                            {t(`country.tenureSwitch.${value}`)}
                            <span className="font-semibold tabular-nums">
                                {format.number(counts[value])}
                            </span>
                        </ToggleGroupItem>
                    ))}
                </ToggleGroup>
                {tenure === "current" ? (
                    <CompactSelect
                        items={sortItems}
                        label={t("sort.label")}
                        onValueChange={handleSortChange}
                        value={sort}
                    />
                ) : (
                    <CompactSelect
                        items={layoutItems}
                        label={t("country.formerLayout.label")}
                        onValueChange={handleFormerLayoutChange}
                        value={formerLayout}
                    />
                )}
            </div>

            {list}
        </div>
    );
}

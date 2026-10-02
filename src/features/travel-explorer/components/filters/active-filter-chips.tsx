"use client";

import { IconX } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { useCallback } from "react";

import { useDateRangeLabel } from "@/features/travel-explorer/hooks/use-date-range-label";
import { useExplorerFormat } from "@/features/travel-explorer/hooks/use-explorer-format";
import { useExplorerState } from "@/features/travel-explorer/hooks/use-explorer-state";
import type { ExplorerFilters } from "@/features/travel-explorer/types/explorer.types";

interface FilterChip {
    id: string;
    label: string;
    patch: Partial<ExplorerFilters>;
}

const without = <T,>(values: readonly T[], value: T): T[] =>
    values.filter((candidate) => candidate !== value);

function FilterChipButton({
    chip,
    onRemove,
}: {
    chip: FilterChip;
    onRemove: (patch: Partial<ExplorerFilters>) => void;
}) {
    const t = useTranslations("Explorer.filters");
    const handleClick = useCallback(() => onRemove(chip.patch), [onRemove, chip.patch]);

    return (
        <button
            aria-label={t("removeFilter", { filter: chip.label })}
            className="inline-flex h-6 max-w-56 items-center gap-1 rounded-md border bg-secondary pr-1 pl-2 text-secondary-foreground text-xs outline-none transition-colors hover:bg-secondary/70 focus-visible:ring-3 focus-visible:ring-ring/50"
            onClick={handleClick}
            type="button"
        >
            <span className="truncate">{chip.label}</span>
            <IconX aria-hidden className="size-3 shrink-0 opacity-60" />
        </button>
    );
}

/** One removable chip per active filter value, so it is always clear what narrows the data. */
export function ActiveFilterChips() {
    const t = useTranslations("Explorer");
    const format = useExplorerFormat();
    const describeRange = useDateRangeLabel();
    const { filters, setFilters } = useExplorerState();

    const chips: FilterChip[] = [];
    const addChip = (id: string, label: string, patch: Partial<ExplorerFilters>) =>
        chips.push({ id, label, patch });

    if (filters.from || filters.to) {
        addChip("dates", describeRange(filters.from, filters.to), { from: null, to: null });
    }
    if (filters.name.trim()) {
        addChip("name", t("filters.chips.name", { value: filters.name.trim() }), { name: "" });
    }
    if (filters.tenure) {
        addChip("tenure", t(`tenure.${filters.tenure}`), { tenure: null });
    }
    for (const role of filters.roles) {
        addChip(`role-${role}`, t(`roles.${role}`), { roles: without(filters.roles, role) });
    }
    if (filters.includePreviousPositions) {
        addChip("previous", t("filters.chips.previousPositions"), {
            includePreviousPositions: false,
        });
    }
    for (const portfolio of filters.portfolios) {
        addChip(`portfolio-${portfolio}`, t(`portfolios.${portfolio}`), {
            portfolios: without(filters.portfolios, portfolio),
        });
    }
    if (filters.party) {
        addChip("party", filters.party, { party: null });
    }
    for (const type of filters.types) {
        addChip(`type-${type}`, t(`travelTypes.${type}`), { types: without(filters.types, type) });
    }
    for (const status of filters.statuses) {
        addChip(`status-${status}`, t(`statuses.${status}`), {
            statuses: without(filters.statuses, status),
        });
    }
    for (const region of filters.regions) {
        addChip(`region-${region}`, t(`regions.${region}`), {
            regions: without(filters.regions, region),
        });
    }
    for (const code of filters.destinations) {
        addChip(
            `destination-${code}`,
            t("filters.chips.visited", { country: format.countryName(code) }),
            { destinations: without(filters.destinations, code) }
        );
    }
    if (filters.city.trim()) {
        addChip("city", t("filters.chips.city", { value: filters.city.trim() }), { city: "" });
    }

    if (chips.length === 0) {
        return null;
    }

    return (
        <ul aria-label={t("filters.activeLabel")} className="flex flex-wrap gap-1.5">
            {chips.map((chip) => (
                <li key={chip.id}>
                    <FilterChipButton chip={chip} onRemove={setFilters} />
                </li>
            ))}
        </ul>
    );
}

"use client";

import { IconFilterOff } from "@tabler/icons-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty";
import { useExplorerState } from "@/features/travel-explorer/hooks/use-explorer-state";
import { countActiveFilters } from "@/features/travel-explorer/utils/filters.utils";

interface ClearFiltersEmptyProps {
    description: string;
    title: string;
}

/** Empty state that offers to clear filters whenever filters are what hides the results. */
export function ClearFiltersEmpty({ title, description }: ClearFiltersEmptyProps) {
    const t = useTranslations("Explorer.filters");
    const { filters, resetFilters } = useExplorerState();
    const hasFilters = countActiveFilters(filters) > 0;

    return (
        <Empty className="border p-6">
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <IconFilterOff />
                </EmptyMedia>
                <EmptyTitle className="text-sm">{title}</EmptyTitle>
                <EmptyDescription>{description}</EmptyDescription>
            </EmptyHeader>
            {hasFilters ? (
                <EmptyContent>
                    <Button onClick={resetFilters} size="sm" variant="outline">
                        {t("resetAll")}
                    </Button>
                </EmptyContent>
            ) : null}
        </Empty>
    );
}

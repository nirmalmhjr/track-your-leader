"use client";

import { IconCalendar, IconChevronDown } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
    CustomDateFields,
    DatePresetList,
} from "@/features/travel-explorer/components/filters/date-range-fields";
import { useDateRangeLabel } from "@/features/travel-explorer/hooks/use-date-range-label";
import { useExplorerState } from "@/features/travel-explorer/hooks/use-explorer-state";

/** The date range is the filter people reach for first, so it gets its own quick control. */
export function DateRangePopover() {
    const t = useTranslations("Explorer.dates");
    const { filters } = useExplorerState();
    const describeRange = useDateRangeLabel();
    const [isOpen, setIsOpen] = useState(false);
    const close = useCallback(() => setIsOpen(false), []);
    const isActive = filters.from !== null || filters.to !== null;

    return (
        <Popover onOpenChange={setIsOpen} open={isOpen}>
            <PopoverTrigger
                render={
                    <Button
                        aria-label={t("triggerLabel", {
                            range: describeRange(filters.from, filters.to),
                        })}
                        className="min-w-0 max-w-full"
                        size="sm"
                        variant={isActive ? "secondary" : "outline"}
                    />
                }
            >
                <IconCalendar data-icon="inline-start" />
                <span className="truncate">{describeRange(filters.from, filters.to)}</span>
                <IconChevronDown data-icon="inline-end" />
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 gap-2 p-1">
                <DatePresetList onSelect={close} />
                <Separator />
                <div className="flex flex-col gap-2 p-2">
                    <p className="font-medium text-muted-foreground text-xs">{t("customRange")}</p>
                    <CustomDateFields />
                </div>
            </PopoverContent>
        </Popover>
    );
}

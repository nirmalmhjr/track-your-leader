"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useCallback, useState } from "react";

import { Button } from "@/components/ui/button";

interface ChartCardProps {
    children: ReactNode;
    id: string;
    /** The same values as a table, so no value depends on hovering the chart. */
    table: ReactNode;
    title: string;
}

/** Chart card: title, the chart, and a toggle to its table twin. */
export function ChartCard({ id, title, table, children }: ChartCardProps) {
    const t = useTranslations("Leaders.profile");
    const [isTableShown, setTableShown] = useState(false);
    const toggle = useCallback(() => setTableShown((shown) => !shown), []);

    return (
        <figure
            aria-labelledby={id}
            className="flex h-full flex-col gap-4 rounded-xl border bg-card p-4"
        >
            <div className="flex items-center justify-between gap-3">
                <figcaption className="font-medium text-sm" id={id}>
                    {title}
                </figcaption>
                <Button aria-expanded={isTableShown} onClick={toggle} size="xs" variant="ghost">
                    {isTableShown ? t("hideTable") : t("showTable")}
                </Button>
            </div>
            {isTableShown ? table : children}
        </figure>
    );
}

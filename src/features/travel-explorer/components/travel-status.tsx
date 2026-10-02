"use client";

import {
    IconCalendarEvent,
    IconCalendarQuestion,
    IconCircleCheck,
    IconCircleX,
    IconPlaneInflight,
} from "@tabler/icons-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { ROUTE_STYLES } from "@/features/travel-explorer/constants/map-style.constants";
import type {
    IsoDate,
    TravelRecord,
    TravelStatus,
} from "@/features/travel-explorer/types/travel.types";
import { isTripInProgress } from "@/features/travel-explorer/utils/travel-aggregates.utils";
import { cn } from "@/lib/utils";

const STATUS_ICONS = {
    cancelled: IconCircleX,
    completed: IconCircleCheck,
    planned: IconCalendarQuestion,
    upcoming: IconCalendarEvent,
} as const;

interface TravelStatusBadgeProps {
    className?: string;
    record: TravelRecord;
    today: IsoDate;
}

/** Trip status shown as icon plus label, so status never relies on colour alone. */
export function TravelStatusBadge({ record, today, className }: TravelStatusBadgeProps) {
    const t = useTranslations("Explorer.statuses");
    const inProgress = isTripInProgress(record, today);
    const Icon = inProgress ? IconPlaneInflight : STATUS_ICONS[record.status];

    return (
        <Badge className={cn("font-normal", className)} variant="outline">
            <Icon
                aria-hidden
                data-icon="inline-start"
                style={{ color: ROUTE_STYLES[record.status].color }}
            />
            {inProgress ? t("inProgress") : t(record.status)}
        </Badge>
    );
}

/** Short stroke matching the line texture used for a status on the map. */
export function RouteLineKey({ status, className }: { status: TravelStatus; className?: string }) {
    const style = ROUTE_STYLES[status];

    return (
        <svg
            aria-hidden
            className={cn("shrink-0", className)}
            height="8"
            viewBox="0 0 24 8"
            width="24"
        >
            <line
                stroke={style.color}
                strokeDasharray={style.dashArray}
                strokeLinecap="round"
                strokeWidth={2.25}
                x1="2"
                x2="22"
                y1="4"
                y2="4"
            />
        </svg>
    );
}

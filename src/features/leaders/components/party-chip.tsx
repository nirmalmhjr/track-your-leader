"use client";

import { useTranslations } from "next-intl";

import { OTHER_PARTY_COLOR_CLASS } from "@/features/leaders/constants/leaders.constants";
import type { PartyColors } from "@/features/leaders/types/leaders.types";
import { abbreviateParty } from "@/lib/travel/party.utils";
import { cn } from "@/lib/utils";

interface PartyChipProps {
    className?: string;
    colors: PartyColors;
    party: string | null;
}

/**
 * A party as a chip in its breakdown colour. Long names are shortened to their initials, with
 * the full name on hover and for screen readers. Without a party it says none is recorded.
 */
export function PartyChip({ className, colors, party }: PartyChipProps) {
    const t = useTranslations("Leaders.card");

    if (!party) {
        return (
            <span
                className={cn(
                    "inline-flex items-center rounded-full border border-dashed px-2 py-px text-muted-foreground text-xs",
                    className
                )}
            >
                {t("partyNotRecorded")}
            </span>
        );
    }

    const label = abbreviateParty(party);
    const isShortened = label !== party;

    return (
        <span
            className={cn(
                "inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full border bg-muted px-2 py-px font-medium text-foreground text-xs",
                className
            )}
            title={isShortened ? party : undefined}
        >
            <span
                aria-hidden
                className={cn(
                    "size-2 shrink-0 rounded-full",
                    colors.get(party) ?? OTHER_PARTY_COLOR_CLASS
                )}
            />
            {isShortened ? (
                <>
                    <span aria-hidden>{label}</span>
                    <span className="sr-only">{party}</span>
                </>
            ) : (
                <span className="truncate">{party}</span>
            )}
        </span>
    );
}

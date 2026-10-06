"use client";

import { useTranslations } from "next-intl";

import {
    OTHER_PARTY_COLOR_CLASS,
    UNKNOWN_PARTY_COLOR_CLASS,
} from "@/features/leaders/constants/leaders.constants";
import type { PartyColors } from "@/features/leaders/types/leaders.types";
import { useTravelFormat } from "@/hooks/use-travel-format";
import { abbreviateParty, type PartyCount } from "@/lib/travel/party.utils";
import { cn } from "@/lib/utils";

/** React key of the row counting officials without a recorded party. */
const UNKNOWN_PARTY_KEY = "unknown";

interface PartyBreakdownProps {
    colors: PartyColors;
    /** Seats per party, largest first, unrecorded last. */
    counts: readonly PartyCount[];
}

function PartyName({ party }: { party: string | null }) {
    const t = useTranslations("Leaders.country.partyBreakdown");
    if (!party) {
        return <span className="text-muted-foreground">{t("notRecorded")}</span>;
    }
    const label = abbreviateParty(party);
    if (label === party) {
        return <span className="font-medium">{party}</span>;
    }
    return (
        <span>
            <span className="font-medium">{label}</span>{" "}
            <span className="text-muted-foreground">{party}</span>
        </span>
    );
}

/**
 * How a cabinet's seats split between parties: a stacked bar, and a legend that names each
 * party with its count. The bar repeats the legend, so it is hidden from screen readers.
 */
export function PartyBreakdown({ colors, counts }: PartyBreakdownProps) {
    const t = useTranslations("Leaders.country.partyBreakdown");
    const format = useTravelFormat();
    const total = counts.reduce((sum, row) => sum + row.count, 0);
    const unknown = counts.find((row) => row.party === null)?.count ?? 0;
    const colorOf = (party: string | null): string =>
        party === null ? UNKNOWN_PARTY_COLOR_CLASS : (colors.get(party) ?? OTHER_PARTY_COLOR_CLASS);

    return (
        <figure className="m-0 flex flex-col gap-3 rounded-xl border bg-card p-4">
            <figcaption className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
                <span className="font-medium">{t("title")}</span>
                <span className="text-muted-foreground tabular-nums">
                    {t("known", {
                        knownLabel: format.number(total - unknown),
                        totalLabel: format.number(total),
                    })}
                </span>
            </figcaption>
            <div aria-hidden className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-muted">
                {counts.map((row) => (
                    <span
                        className={cn("min-w-1", colorOf(row.party))}
                        key={row.party ?? UNKNOWN_PARTY_KEY}
                        style={{ flexGrow: row.count }}
                    />
                ))}
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
                {counts.map((row) => (
                    <li
                        className="flex min-w-0 items-center gap-1.5"
                        key={row.party ?? UNKNOWN_PARTY_KEY}
                    >
                        <span
                            aria-hidden
                            className={cn("size-2.5 shrink-0 rounded-[3px]", colorOf(row.party))}
                        />
                        <PartyName party={row.party} />
                        <span className="font-semibold tabular-nums">
                            {format.number(row.count)}
                        </span>
                    </li>
                ))}
            </ul>
        </figure>
    );
}

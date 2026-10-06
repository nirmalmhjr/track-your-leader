"use client";

import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";

import { OfficialAvatar } from "@/components/shared/official-avatar";
import { ShowMoreButton } from "@/components/shared/show-more-button";
import { Badge } from "@/components/ui/badge";
import { ROUTES } from "@/configs/routes";
import { PartyChip } from "@/features/leaders/components/party-chip";
import type { LeaderEntry, PartyColors } from "@/features/leaders/types/leaders.types";
import { useTravelFormat } from "@/hooks/use-travel-format";
import { Link } from "@/i18n/navigation";
import { getTermYears } from "@/lib/travel/offices.utils";
import { getLeadingCategory, getPrimaryPosition } from "@/lib/travel/officials.utils";

/** Rows rendered per page. */
const PAGE_SIZE = 12;

function OtherOfficialRow({
    entry,
    partyColors,
}: {
    entry: LeaderEntry;
    partyColors: PartyColors;
}) {
    const tCard = useTranslations("Leaders.card");
    const tRoles = useTranslations("Explorer.roles");
    const format = useTravelFormat();
    const { official, summary } = entry;
    const position = getPrimaryPosition(official);
    const { start } = getTermYears(position);

    return (
        <li>
            <Link
                className="flex items-center gap-3 px-3 py-2.5 outline-none transition-colors hover:bg-accent/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
                href={ROUTES.leadersProfile(official.countryCode, official.id)}
            >
                <OfficialAvatar official={official} size="sm" />
                <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium text-sm">{official.fullName}</span>
                    <span className="truncate text-muted-foreground text-xs">{position.title}</span>
                </span>
                {official.party ? (
                    <PartyChip
                        className="max-sm:hidden"
                        colors={partyColors}
                        party={official.party}
                    />
                ) : null}
                <Badge className="max-md:hidden" variant="secondary">
                    {tRoles(getLeadingCategory(position))}
                </Badge>
                {summary.tripCount > 0 ? (
                    <span className="shrink-0 font-medium text-xs tabular-nums">
                        {format.number(summary.tripCount)}{" "}
                        {tCard("trips", { count: summary.tripCount })}
                    </span>
                ) : null}
                {start ? (
                    <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
                        {tCard("since", { year: format.year(start) })}
                    </span>
                ) : null}
            </Link>
        </li>
    );
}

interface OtherOfficialsListProps {
    entries: readonly LeaderEntry[];
    partyColors: PartyColors;
}

/** Office holders outside the government, such as central bankers and ambassadors, one line each. */
export function OtherOfficialsList({ entries, partyColors }: OtherOfficialsListProps) {
    const t = useTranslations("Leaders.country");
    const format = useTravelFormat();
    const [shown, setShown] = useState(PAGE_SIZE);
    const showMore = useCallback(() => setShown((count) => count + PAGE_SIZE), []);
    const remaining = entries.length - shown;

    return (
        <div className="flex flex-col gap-2">
            <ul className="divide-y overflow-hidden rounded-xl border bg-card">
                {entries.slice(0, shown).map((entry) => (
                    <OtherOfficialRow
                        entry={entry}
                        key={entry.official.id}
                        partyColors={partyColors}
                    />
                ))}
            </ul>
            {remaining > 0 ? (
                <ShowMoreButton
                    label={t("showMoreOfficials", {
                        count: Math.min(remaining, PAGE_SIZE),
                        countLabel: format.number(Math.min(remaining, PAGE_SIZE)),
                    })}
                    onShowMore={showMore}
                    shownCount={shown}
                />
            ) : null}
        </div>
    );
}

"use client";

import { useTranslations } from "next-intl";

import { CabinetTable } from "@/features/leaders/components/cabinet-table";
import { LeaderCard } from "@/features/leaders/components/leader-card";
import { OtherOfficialsList } from "@/features/leaders/components/other-officials-list";
import { PartyBreakdown } from "@/features/leaders/components/party-breakdown";
import { SectionHeading } from "@/features/leaders/components/section-heading";
import type { LeaderEntry } from "@/features/leaders/types/leaders.types";
import { assignPartyColors, splitInOffice } from "@/features/leaders/utils/leaders.utils";
import { useTravelFormat } from "@/hooks/use-travel-format";
import { countParties } from "@/lib/travel/party.utils";

const officialsOf = (entries: readonly LeaderEntry[]) => entries.map((entry) => entry.official);

interface InOfficeDirectoryProps {
    /** Everyone in office, so party colours and the breakdown hold still while filtering. */
    allEntries: readonly LeaderEntry[];
    countryName: string;
    /** Those in office matching the name filter, most senior first. */
    entries: readonly LeaderEntry[];
    /** Message for a name filter that matches no one; `null` when no filter is applied. */
    noMatchLabel: string | null;
}

/**
 * Who holds office in a country, in three sections: the top leaders as cards, the cabinet as a
 * table with its party breakdown, and other office holders one line each.
 */
export function InOfficeDirectory({
    allEntries,
    countryName,
    entries,
    noMatchLabel,
}: InOfficeDirectoryProps) {
    const t = useTranslations("Leaders.country");
    const format = useTravelFormat();

    if (entries.length === 0) {
        return (
            <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground text-sm">
                {noMatchLabel ?? t("noneInOffice", { country: countryName })}
            </p>
        );
    }

    const cabinetCounts = countParties(officialsOf(splitInOffice(allEntries).ministers));
    const partyColors = assignPartyColors([
        ...cabinetCounts,
        ...countParties(officialsOf(allEntries)),
    ]);
    const showBreakdown = noMatchLabel === null && cabinetCounts.some((row) => row.party !== null);
    const { leadership, ministers, others } = splitInOffice(entries);

    return (
        <div className="@container flex flex-col gap-10">
            {leadership.length > 0 ? (
                <section aria-labelledby="in-office-leadership" className="flex flex-col gap-4">
                    <SectionHeading
                        caption={t("leadershipCaption")}
                        id="in-office-leadership"
                        title={t("leadershipTitle")}
                    />
                    {/* By the section's width: beside the rail a tablet only fits one card. */}
                    <ul className="grid @2xl:grid-cols-2 @5xl:grid-cols-3 gap-3">
                        {leadership.map((entry) => (
                            <li key={entry.official.id}>
                                <LeaderCard
                                    entry={entry}
                                    partyColors={partyColors}
                                    showStatus={false}
                                />
                            </li>
                        ))}
                    </ul>
                </section>
            ) : null}

            {ministers.length > 0 ? (
                <section aria-labelledby="in-office-cabinet" className="flex flex-col gap-4">
                    <SectionHeading
                        caption={t("cabinetCaption", {
                            count: ministers.length,
                            countLabel: format.number(ministers.length),
                        })}
                        id="in-office-cabinet"
                        title={t("cabinetTitle")}
                    />
                    {showBreakdown ? (
                        <PartyBreakdown colors={partyColors} counts={cabinetCounts} />
                    ) : null}
                    <CabinetTable entries={ministers} partyColors={partyColors} />
                </section>
            ) : null}

            {others.length > 0 ? (
                <section aria-labelledby="in-office-others" className="flex flex-col gap-4">
                    <SectionHeading
                        caption={t("othersCaption")}
                        id="in-office-others"
                        title={t("othersTitle")}
                    />
                    <OtherOfficialsList entries={others} partyColors={partyColors} />
                </section>
            ) : null}
        </div>
    );
}

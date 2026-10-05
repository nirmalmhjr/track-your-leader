"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "@/features/leaders/components/section-heading";
import { useDirectoryFormat } from "@/features/leaders/hooks/use-directory-format";
import type { Position } from "@/features/travel-explorer/types/travel.types";
import { cn } from "@/lib/utils";

/** "March 2015 – October 2023", "Since …", "Until …" or "Present"-ended, whatever the source gives. */
function useTenureLabel(position: Position): string {
    const t = useTranslations("Leaders.profile");
    const tOfficial = useTranslations("Explorer.official");
    const format = useDirectoryFormat();
    const { startDate, endDate } = position;

    if (startDate) {
        const end = endDate ? format.monthYear(endDate) : t("present");
        return `${format.monthYear(startDate)} – ${end}`;
    }
    if (endDate) {
        return tOfficial("until", { date: format.monthYear(endDate) });
    }
    return t("dateUnknown");
}

function CareerEntry({ position }: { position: Position }) {
    const tOfficial = useTranslations("Explorer.official");
    const tPortfolio = useTranslations("Explorer.portfolios");
    const tenure = useTenureLabel(position);
    const isCurrent = position.endDate === null;

    return (
        <li className="relative flex flex-col gap-1 pb-6 last:pb-0">
            <span
                aria-hidden
                className={cn(
                    "absolute top-1.5 -left-[29.5px] size-2.5 rounded-full",
                    isCurrent
                        ? "bg-primary ring-4 ring-primary/20"
                        : "border-2 border-muted-foreground/50 bg-background"
                )}
            />
            <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-medium leading-snug">{position.title}</h3>
                {isCurrent ? <Badge variant="secondary">{tOfficial("current")}</Badge> : null}
            </div>
            {position.ministry ? (
                <p className="text-muted-foreground text-sm">{position.ministry}</p>
            ) : null}
            <p className="text-muted-foreground text-xs tabular-nums">{tenure}</p>
            {position.portfolio ? (
                <Badge className="mt-1 self-start" variant="outline">
                    {tPortfolio(position.portfolio)}
                </Badge>
            ) : null}
        </li>
    );
}

/** Every position the official held, newest first, on a vertical timeline. */
export function CareerTimeline({ positions }: { positions: readonly Position[] }) {
    const t = useTranslations("Leaders.profile");
    const format = useDirectoryFormat();

    return (
        <section aria-labelledby="career" className="flex flex-col gap-5">
            <SectionHeading
                caption={t("careerCaption", {
                    count: positions.length,
                    countLabel: format.number(positions.length),
                })}
                id="career"
                title={t("career")}
            />
            <ol className="ml-1.5 border-l pl-6">
                {positions.map((position) => (
                    <CareerEntry key={position.id} position={position} />
                ))}
            </ol>
        </section>
    );
}

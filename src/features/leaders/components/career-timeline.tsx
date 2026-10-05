import { getTranslations } from "next-intl/server";

import { badgeVariants } from "@/components/ui/badge";
import { SectionHeading } from "@/features/leaders/components/section-heading";
import type { TravelFormat } from "@/lib/travel/travel-format";
import { getTravelFormat } from "@/lib/travel/travel-format.server";
import { cn } from "@/lib/utils";
import type { Position } from "@/types/travel.types";

interface TenureLabels {
    present: string;
    unknown: string;
    until: (date: string) => string;
}

/** "March 2015 – October 2023", "Until …" or "Present"-ended, whatever the source gives. */
const formatTenure = (position: Position, format: TravelFormat, labels: TenureLabels): string => {
    const { startDate, endDate } = position;
    if (startDate) {
        const end = endDate ? format.monthYear(endDate) : labels.present;
        return `${format.monthYear(startDate)} – ${end}`;
    }
    if (endDate) {
        return labels.until(format.monthYear(endDate));
    }
    return labels.unknown;
};

interface CareerEntryProps {
    currentLabel: string;
    portfolioLabel: string | null;
    position: Position;
    tenure: string;
}

function CareerEntry({ position, tenure, currentLabel, portfolioLabel }: CareerEntryProps) {
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
                {isCurrent ? (
                    <span className={badgeVariants({ variant: "secondary" })}>{currentLabel}</span>
                ) : null}
            </div>
            {position.ministry ? (
                <p className="text-muted-foreground text-sm">{position.ministry}</p>
            ) : null}
            <p className="text-muted-foreground text-xs tabular-nums">{tenure}</p>
            {portfolioLabel ? (
                <span
                    className={badgeVariants({ className: "mt-1 self-start", variant: "outline" })}
                >
                    {portfolioLabel}
                </span>
            ) : null}
        </li>
    );
}

/** Every position the official held, newest first, on a vertical timeline. */
export async function CareerTimeline({ positions }: { positions: readonly Position[] }) {
    const [t, tOfficial, tPortfolio, format] = await Promise.all([
        getTranslations("Leaders.profile"),
        getTranslations("Explorer.official"),
        getTranslations("Explorer.portfolios"),
        getTravelFormat(),
    ]);
    const labels: TenureLabels = {
        present: t("present"),
        unknown: t("dateUnknown"),
        until: (date) => tOfficial("until", { date }),
    };

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
                    <CareerEntry
                        currentLabel={tOfficial("current")}
                        key={position.id}
                        portfolioLabel={position.portfolio ? tPortfolio(position.portfolio) : null}
                        position={position}
                        tenure={formatTenure(position, format, labels)}
                    />
                ))}
            </ol>
        </section>
    );
}

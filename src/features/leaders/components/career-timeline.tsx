import { getTranslations } from "next-intl/server";

import { badgeVariants } from "@/components/ui/badge";
import { SectionHeading } from "@/features/leaders/components/section-heading";
import { groupPositionsByOffice } from "@/lib/travel/officials.utils";
import type { TravelFormat } from "@/lib/travel/travel-format";
import { getTravelFormat } from "@/lib/travel/travel-format.server";
import { cn } from "@/lib/utils";
import type { OfficeTerms, Position } from "@/types/travel.types";

interface TenureLabels {
    fromEndUnknown: (date: string) => string;
    present: string;
    unknown: string;
    until: (date: string) => string;
}

/** "March 2015 – October 2023", "Until …" or "Present"-ended, whatever the source gives. */
const formatTenure = (position: Position, format: TravelFormat, labels: TenureLabels): string => {
    const { startDate, endDate } = position;
    if (position.undated) {
        return startDate ? labels.fromEndUnknown(format.monthYear(startDate)) : labels.unknown;
    }
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
    office: OfficeTerms;
    portfolioLabel: string | null;
    /** One line per term in the office, newest first, keyed by the term's position id. */
    tenures: readonly { id: string; label: string }[];
}

function CareerEntry({ office, tenures, currentLabel, portfolioLabel }: CareerEntryProps) {
    const { isCurrent, title } = office;
    const [latest] = office.terms;

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
                <h3 className="font-medium leading-snug">{title}</h3>
                {isCurrent ? (
                    <span className={badgeVariants({ variant: "secondary" })}>{currentLabel}</span>
                ) : null}
            </div>
            {latest?.ministry ? (
                <p className="text-muted-foreground text-sm">{latest.ministry}</p>
            ) : null}
            <ul className="flex flex-col gap-0.5 text-muted-foreground text-xs tabular-nums">
                {tenures.map((tenure) => (
                    <li key={tenure.id}>{tenure.label}</li>
                ))}
            </ul>
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

/**
 * Every office the official held, newest first, on a vertical timeline. An office held more than
 * once is one entry listing each term.
 */
export async function CareerTimeline({ positions }: { positions: readonly Position[] }) {
    const offices = groupPositionsByOffice(positions);
    const [t, tOfficial, tPortfolio, format] = await Promise.all([
        getTranslations("Leaders.profile"),
        getTranslations("Explorer.official"),
        getTranslations("Explorer.portfolios"),
        getTravelFormat(),
    ]);
    const labels: TenureLabels = {
        fromEndUnknown: (date) => tOfficial("fromEndUnknown", { date }),
        present: t("present"),
        unknown: t("dateUnknown"),
        until: (date) => tOfficial("until", { date }),
    };

    return (
        <section aria-labelledby="career" className="flex flex-col gap-5">
            <SectionHeading
                caption={t("careerCaption", {
                    count: offices.length,
                    countLabel: format.number(offices.length),
                })}
                id="career"
                title={t("career")}
            />
            <ol className="ml-1.5 border-l pl-6">
                {offices.map((office) => (
                    <CareerEntry
                        currentLabel={tOfficial("current")}
                        key={office.title}
                        office={office}
                        portfolioLabel={
                            office.terms[0]?.portfolio
                                ? tPortfolio(office.terms[0].portfolio)
                                : null
                        }
                        tenures={office.terms.map((term) => ({
                            id: term.id,
                            label: formatTenure(term, format, labels),
                        }))}
                    />
                ))}
            </ol>
        </section>
    );
}

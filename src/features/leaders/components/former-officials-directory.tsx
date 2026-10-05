"use client";

import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";

import { OfficialAvatar } from "@/components/shared/official-avatar";
import { ShowMoreButton } from "@/components/shared/show-more-button";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ROUTES } from "@/configs/routes";
import { SectionHeading } from "@/features/leaders/components/section-heading";
import { useTravelFormat } from "@/hooks/use-travel-format";
import { Link } from "@/i18n/navigation";
import {
    getHeldOfficeKeys,
    groupOffices,
    groupPastTermsByYear,
    type Office,
    type OfficeTerm,
} from "@/lib/travel/offices.utils";
import type { Official } from "@/types/travel.types";

const LAYOUTS = ["office", "year"] as const;
type Layout = (typeof LAYOUTS)[number];

/** Offices, and years, rendered per page. */
const OFFICE_PAGE_SIZE = 12;
const YEAR_PAGE_SIZE = 8;
/** Earlier holders listed per office before "show all". */
const TERMS_PREVIEW = 5;

/** "2019 – 2021", a single year for a stint within one year, or "Until 2021" without a start. */
function useTermYears(term: OfficeTerm): string {
    const t = useTranslations("Explorer.official");
    const format = useTravelFormat();
    const { startDate, endDate } = term.position;

    const endYear = endDate ? format.year(endDate.slice(0, 4)) : "";
    if (!startDate) {
        return t("until", { date: endYear });
    }
    const startYear = format.year(startDate.slice(0, 4));
    return startYear === endYear ? endYear : `${startYear} – ${endYear}`;
}

function OfficialLink({ official }: { official: Official }) {
    return (
        <Link
            className="truncate rounded-sm font-medium outline-none hover:underline hover:underline-offset-2 focus-visible:ring-3 focus-visible:ring-ring/50"
            href={ROUTES.leadersProfile(official.countryCode, official.id)}
        >
            {official.fullName}
        </Link>
    );
}

function OfficeTimelineTerm({ term }: { term: OfficeTerm }) {
    const years = useTermYears(term);

    return (
        <li className="relative flex items-baseline justify-between gap-3 text-sm">
            <span
                aria-hidden
                className="absolute top-2 -left-[20.5px] size-2 rounded-full border-2 border-card bg-muted-foreground/60"
            />
            <OfficialLink official={term.official} />
            <span className="shrink-0 text-muted-foreground text-xs tabular-nums">{years}</span>
        </li>
    );
}

/** One office: who holds it now, and its earlier holders on a timeline. */
function OfficeCard({ office }: { office: Office }) {
    const t = useTranslations("Leaders.country");
    const format = useTravelFormat();
    const [isExpanded, setExpanded] = useState(false);
    const toggle = useCallback(() => setExpanded((expanded) => !expanded), []);
    const terms = isExpanded ? office.past : office.past.slice(0, TERMS_PREVIEW);

    return (
        <article className="flex flex-col gap-3 rounded-xl border bg-card p-4">
            <header className="flex items-start justify-between gap-3">
                <h3 className="font-medium leading-snug">{office.title}</h3>
                <span className="shrink-0 text-muted-foreground text-xs">
                    {t("holders", {
                        count: office.holderCount,
                        countLabel: format.number(office.holderCount),
                    })}
                </span>
            </header>
            {office.current.length > 0 ? (
                <p className="flex min-w-0 items-center gap-2 text-sm">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary text-xs">
                        {t("now")}
                    </span>
                    {office.current.map((term) => (
                        <OfficialLink key={term.official.id} official={term.official} />
                    ))}
                </p>
            ) : null}
            <ol className="ml-1 flex flex-col gap-2 border-l pl-4">
                {terms.map((term) => (
                    <OfficeTimelineTerm key={term.position.id} term={term} />
                ))}
            </ol>
            {office.past.length > TERMS_PREVIEW ? (
                <Button className="self-start" onClick={toggle} size="xs" variant="ghost">
                    {isExpanded
                        ? t("showFewerTerms")
                        : t("showAllTerms", { countLabel: format.number(office.past.length) })}
                </Button>
            ) : null}
        </article>
    );
}

function ByOffice({
    officials,
    allOfficials,
}: {
    officials: Official[];
    allOfficials: Official[];
}) {
    const t = useTranslations("Leaders.country");
    const format = useTravelFormat();
    const [shown, setShown] = useState(OFFICE_PAGE_SIZE);
    const offices = useMemo(
        () =>
            groupOffices(officials, getHeldOfficeKeys(allOfficials)).filter(
                (office) => office.past.length > 0
            ),
        [officials, allOfficials]
    );
    const showMore = useCallback(() => setShown((count) => count + OFFICE_PAGE_SIZE), []);
    const remaining = offices.length - shown;

    return (
        <div className="flex flex-col gap-3">
            <ul className="grid gap-3 lg:grid-cols-2">
                {offices.slice(0, shown).map((office) => (
                    <li key={office.key}>
                        <OfficeCard office={office} />
                    </li>
                ))}
            </ul>
            {remaining > 0 ? (
                <ShowMoreButton
                    label={t("showMoreOffices", {
                        count: remaining,
                        countLabel: format.number(remaining),
                    })}
                    onShowMore={showMore}
                    shownCount={shown}
                />
            ) : null}
        </div>
    );
}

function YearTerm({ term }: { term: OfficeTerm }) {
    const years = useTermYears(term);

    return (
        <li className="flex items-center gap-3 py-2">
            <OfficialAvatar official={term.official} size="sm" />
            <div className="flex min-w-0 flex-1 flex-col">
                <OfficialLink official={term.official} />
                <span className="truncate text-muted-foreground text-xs">
                    {term.position.title}
                </span>
            </div>
            <span className="shrink-0 text-muted-foreground text-xs tabular-nums">{years}</span>
        </li>
    );
}

function ByYear({ officials }: { officials: Official[] }) {
    const t = useTranslations("Leaders.country");
    const format = useTravelFormat();
    const [shown, setShown] = useState(YEAR_PAGE_SIZE);
    const years = useMemo(() => groupPastTermsByYear(officials), [officials]);
    const showMore = useCallback(() => setShown((count) => count + YEAR_PAGE_SIZE), []);
    const remaining = years.length - shown;

    return (
        <div className="flex flex-col gap-3">
            <ol className="grid gap-3 lg:grid-cols-2">
                {years.slice(0, shown).map(({ year, terms }) => (
                    <li className="rounded-xl border bg-card p-4" key={year}>
                        <div className="flex items-baseline justify-between gap-3 border-b pb-2">
                            <h3 className="font-semibold text-xl tabular-nums">
                                {format.year(year)}
                            </h3>
                            <span className="text-muted-foreground text-xs">
                                {t("leftOffice", {
                                    count: terms.length,
                                    countLabel: format.number(terms.length),
                                })}
                            </span>
                        </div>
                        <ul className="divide-y">
                            {terms.map((term) => (
                                <YearTerm
                                    key={`${term.official.id}-${term.position.id}`}
                                    term={term}
                                />
                            ))}
                        </ul>
                    </li>
                ))}
            </ol>
            {remaining > 0 ? (
                <ShowMoreButton
                    label={t("showMoreYears", {
                        count: remaining,
                        countLabel: format.number(remaining),
                    })}
                    onShowMore={showMore}
                    shownCount={shown}
                />
            ) : null}
        </div>
    );
}

interface FormerOfficialsDirectoryProps {
    /** Every official of the country, so offices held by someone filtered out still count as held. */
    allOfficials: Official[];
    countryName: string;
    /** Officials matching the name filter. */
    officials: Official[];
}

/** A country's past: each office with its earlier holders, or every finished term by year. */
export function FormerOfficialsDirectory({
    officials,
    allOfficials,
    countryName,
}: FormerOfficialsDirectoryProps) {
    const t = useTranslations("Leaders.country");
    const [layout, setLayout] = useState<Layout>("office");
    const hasPast = useMemo(
        () => officials.some((official) => official.positions.some((position) => position.endDate)),
        [officials]
    );
    const handleLayoutChange = useCallback((values: string[]) => {
        const next = LAYOUTS.find((candidate) => candidate === values[0]);
        if (next) {
            setLayout(next);
        }
    }, []);

    return (
        <section aria-labelledby="former-officials" className="flex flex-col gap-4">
            <SectionHeading
                actions={
                    hasPast ? (
                        <ToggleGroup
                            aria-label={t("layout.label")}
                            onValueChange={handleLayoutChange}
                            size="sm"
                            spacing={0}
                            value={[layout]}
                            variant="outline"
                        >
                            {LAYOUTS.map((value) => (
                                <ToggleGroupItem
                                    className="px-3 text-muted-foreground data-pressed:bg-muted data-pressed:text-foreground"
                                    key={value}
                                    value={value}
                                >
                                    {t(`layout.${value}`)}
                                </ToggleGroupItem>
                            ))}
                        </ToggleGroup>
                    ) : null
                }
                caption={t("formerCaption")}
                id="former-officials"
                title={t("formerTitle")}
            />
            {hasPast ? null : (
                <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground text-sm">
                    {t("noFormer", { country: countryName })}
                </p>
            )}
            {hasPast && layout === "office" ? (
                <ByOffice allOfficials={allOfficials} officials={officials} />
            ) : null}
            {hasPast && layout === "year" ? <ByYear officials={officials} /> : null}
        </section>
    );
}

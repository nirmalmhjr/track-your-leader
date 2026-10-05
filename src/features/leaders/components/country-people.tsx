"use client";

import { IconUsers } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useCallback, useMemo, useState } from "react";

import { OfficialAvatar } from "@/components/shared/official-avatar";
import { ShowMoreButton } from "@/components/shared/show-more-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ROUTES } from "@/configs/routes";
import { SectionHeading } from "@/features/leaders/components/section-heading";
import { useCountryPeople } from "@/features/leaders/hooks/use-country-people";
import { useTravelFormat } from "@/hooks/use-travel-format";
import { Link } from "@/i18n/navigation";
import {
    getCategoryGroup,
    getOfficialRank,
    getPrimaryPosition,
    isCurrentPosition,
} from "@/lib/travel/officials.utils";
import { normalizeSearchText } from "@/lib/utils";
import type { CountryCode } from "@/types/geo.types";
import type { Official, OfficialGroup, Position } from "@/types/travel.types";

/** Rows rendered per page. */
const PAGE_SIZE = 30;
const ALL_GROUPS = "all";

type PeopleGroup = Exclude<OfficialGroup, "former">;
type GroupFilter = PeopleGroup | typeof ALL_GROUPS;

/** Display order of the group switch; leadership and ministers rarely appear here. */
const GROUP_ORDER: readonly PeopleGroup[] = [
    "legislators",
    "regional",
    "judiciary",
    "officials",
    "ministers",
    "leadership",
];

const GROUP_FILTERS: readonly GroupFilter[] = [ALL_GROUPS, ...GROUP_ORDER];

const groupOf = (person: Official): PeopleGroup =>
    getCategoryGroup(getPrimaryPosition(person).categories);

/** In office first, then most senior, then by name. */
const comparePeople = (a: Official, b: Official): number =>
    Number(isCurrentPosition(getPrimaryPosition(b))) -
        Number(isCurrentPosition(getPrimaryPosition(a))) ||
    getOfficialRank(a) - getOfficialRank(b) ||
    a.fullName.localeCompare(b.fullName);

/** "2013 – 2017", "Since 2022", "From 1980" (end not recorded) or nothing at all. */
function useYears(position: Position): string | null {
    const t = useTranslations("Leaders.country");
    const format = useTravelFormat();
    const start = position.startDate ? format.year(position.startDate.slice(0, 4)) : null;
    const end = position.endDate ? format.year(position.endDate.slice(0, 4)) : null;
    if (position.undated) {
        return start ? t("peopleFrom", { year: start }) : null;
    }
    if (!end) {
        return start ? t("peopleSince", { year: start }) : null;
    }
    if (!start || start === end) {
        return end;
    }
    return `${start} – ${end}`;
}

function PersonRow({ code, person }: { code: CountryCode; person: Official }) {
    const t = useTranslations("Leaders.country");
    const position = getPrimaryPosition(person);
    const years = useYears(position);

    return (
        <li>
            <Link
                className="flex items-center gap-3 px-3 py-2.5 outline-none transition-colors hover:bg-accent/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
                href={ROUTES.leadersProfile(code, person.id)}
            >
                <OfficialAvatar official={person} size="sm" />
                <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium text-sm">{person.fullName}</span>
                    <span className="truncate text-muted-foreground text-xs">{position.title}</span>
                </span>
                {isCurrentPosition(position) ? <Badge variant="secondary">{t("now")}</Badge> : null}
                {years ? (
                    <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
                        {years}
                    </span>
                ) : null}
            </Link>
        </li>
    );
}

interface CountryPeopleProps {
    code: CountryCode;
    countryName: string;
    /** Name filter shared with the rest of the directory, already normalised. */
    needle: string;
}

/**
 * Everyone else on record for a country: legislators, regional and city leaders, judges,
 * diplomats and others with no recorded trips. The list can run to tens of thousands, so it
 * loads when asked for and renders a page at a time.
 */
export function CountryPeople({ code, countryName, needle }: CountryPeopleProps) {
    const t = useTranslations("Leaders.country");
    const tGroups = useTranslations("Explorer.roleGroups");
    const format = useTravelFormat();
    const { load, people, status } = useCountryPeople(code);
    const [group, setGroup] = useState<GroupFilter>(ALL_GROUPS);
    const [shown, setShown] = useState(PAGE_SIZE);

    const sorted = useMemo(() => [...people].sort(comparePeople), [people]);
    const named = useMemo(
        () =>
            needle
                ? sorted.filter((person) => normalizeSearchText(person.fullName).includes(needle))
                : sorted,
        [needle, sorted]
    );
    const counts = useMemo(() => {
        const byGroup = new Map<PeopleGroup, number>();
        for (const person of named) {
            const key = groupOf(person);
            byGroup.set(key, (byGroup.get(key) ?? 0) + 1);
        }
        return byGroup;
    }, [named]);
    const visible =
        group === ALL_GROUPS ? named : named.filter((person) => groupOf(person) === group);

    const handleGroupChange = useCallback((values: string[]) => {
        const next = GROUP_FILTERS.find((candidate) => candidate === values[0]);
        if (next) {
            setGroup(next);
            setShown(PAGE_SIZE);
        }
    }, []);
    const showMore = useCallback(() => setShown((count) => count + PAGE_SIZE), []);
    const remaining = visible.length - shown;

    let body: ReactNode;
    if (status === "idle" || status === "error") {
        body = (
            <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed p-5">
                <p className="text-muted-foreground text-sm">
                    {status === "error"
                        ? t("peopleError")
                        : t("peopleIntro", { country: countryName })}
                </p>
                <Button onClick={load} size="sm" variant="outline">
                    <IconUsers data-icon="inline-start" />
                    {status === "error" ? t("peopleRetry") : t("peopleLoad")}
                </Button>
            </div>
        );
    } else if (status === "loading") {
        body = <p className="text-muted-foreground text-sm">{t("peopleLoading")}</p>;
    } else if (named.length === 0) {
        body = (
            <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground text-sm">
                {needle ? t("peopleNoMatch") : t("peopleEmpty", { country: countryName })}
            </p>
        );
    } else {
        body = (
            <>
                <ToggleGroup
                    aria-label={t("peopleGroups")}
                    className="flex-wrap"
                    onValueChange={handleGroupChange}
                    size="sm"
                    value={[group]}
                    variant="outline"
                >
                    <ToggleGroupItem value={ALL_GROUPS}>
                        {t("peopleAll")}
                        <span className="font-semibold tabular-nums">
                            {format.number(named.length)}
                        </span>
                    </ToggleGroupItem>
                    {GROUP_ORDER.filter((key) => counts.has(key)).map((key) => (
                        <ToggleGroupItem key={key} value={key}>
                            {tGroups(key)}
                            <span className="font-semibold tabular-nums">
                                {format.number(counts.get(key) ?? 0)}
                            </span>
                        </ToggleGroupItem>
                    ))}
                </ToggleGroup>
                <ul className="divide-y overflow-hidden rounded-xl border bg-card">
                    {visible.slice(0, shown).map((person) => (
                        <PersonRow code={code} key={person.id} person={person} />
                    ))}
                </ul>
                {remaining > 0 ? (
                    <ShowMoreButton
                        label={t("showMorePeople", {
                            count: Math.min(remaining, PAGE_SIZE),
                            countLabel: format.number(Math.min(remaining, PAGE_SIZE)),
                        })}
                        onShowMore={showMore}
                        shownCount={shown}
                    />
                ) : null}
            </>
        );
    }

    return (
        <section aria-labelledby="everyone-on-record" className="flex flex-col gap-4">
            <SectionHeading
                caption={t("peopleCaption")}
                id="everyone-on-record"
                title={t("peopleTitle")}
            />
            {body}
        </section>
    );
}

"use client";

import { useCallback, useMemo } from "react";

import { SiteSearch } from "@/components/shared/site-search";
import { ROUTES } from "@/configs/routes";
import { useSearchPeople } from "@/features/leaders/hooks/use-search-people";
import { useTravelFormat } from "@/hooks/use-travel-format";
import { useRouter } from "@/i18n/navigation";
import { getCountryReference } from "@/lib/geo/country-reference";
import { getCountrySearchTerms } from "@/lib/geo/country-search-terms";
import { createPersonSearchEntry, createSearchEntry } from "@/lib/travel/search.utils";
import type { CountryCode } from "@/types/geo.types";
import type { SearchCountry, SearchPerson } from "@/types/travel.types";

/**
 * The directory's header search: a country opens its page, a person their profile. Only
 * countries with a page are listed; people load when the search is about to be used.
 */
export function DirectorySearch({ countryCodes }: { countryCodes: readonly CountryCode[] }) {
    const format = useTravelFormat();
    const router = useRouter();
    const { people, prepare, retry, status } = useSearchPeople();

    const countries = useMemo(
        () =>
            countryCodes
                .map((code) => {
                    const reference = getCountryReference(code);
                    const label = format.countryName(code);
                    const country: SearchCountry = {
                        alpha2: reference?.alpha2 ?? "",
                        code,
                        detail: reference?.subregion ?? "",
                        label,
                    };
                    return createSearchEntry(country, label, getCountrySearchTerms(code), {
                        isCurrent: true,
                    });
                })
                .sort((a, b) => a.item.label.localeCompare(b.item.label)),
        [countryCodes, format]
    );

    const peopleEntries = useMemo(
        () =>
            people.map((person) =>
                createPersonSearchEntry(person, format.countryName(person.countryCode))
            ),
        [people, format]
    );

    const chooseCountry = useCallback(
        (country: SearchCountry) => router.push(ROUTES.leadersCountry(country.code)),
        [router]
    );
    const choosePerson = useCallback(
        (person: SearchPerson) => router.push(ROUTES.leadersProfile(person.countryCode, person.id)),
        [router]
    );

    return (
        <SiteSearch
            countries={countries}
            onChooseCountry={chooseCountry}
            onChoosePerson={choosePerson}
            onPrepare={prepare}
            onRetryPeople={retry}
            people={peopleEntries}
            peopleStatus={status === "idle" ? "loading" : status}
        />
    );
}

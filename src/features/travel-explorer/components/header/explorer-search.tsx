"use client";

import { useCallback, useMemo } from "react";

import { SiteSearch } from "@/components/shared/site-search";
import { useExplorerData } from "@/features/travel-explorer/hooks/use-explorer-data";
import { useExplorerState } from "@/features/travel-explorer/hooks/use-explorer-state";
import { useOpenCountry } from "@/features/travel-explorer/hooks/use-open-country";
import { countTrips } from "@/features/travel-explorer/utils/travel-aggregates.utils";
import { useTravelFormat } from "@/hooks/use-travel-format";
import { ALL_COUNTRY_REFERENCES } from "@/lib/geo/country-reference";
import { getCountrySearchTerms } from "@/lib/geo/country-search-terms";
import {
    createPersonSearchEntry,
    createSearchEntry,
    toSearchPerson,
} from "@/lib/travel/search.utils";
import { useExplorerUiStore } from "@/stores/explorer-ui-store";
import type { SearchCountry, SearchPerson } from "@/types/travel.types";

/**
 * The map's header search. Every country can be found, tracked or not (an untracked one opens
 * on the visits it received); a person opens the panel on their travel.
 */
export function ExplorerSearch() {
    const format = useTravelFormat();
    const { allOfficials, allRecords, countryByCode, officialById, retry, status } =
        useExplorerData();
    const { selectOfficial } = useExplorerState();
    const openCountry = useOpenCountry();
    const setPanelOpen = useExplorerUiStore((state) => state.setPanelOpen);

    const countries = useMemo(
        () =>
            ALL_COUNTRY_REFERENCES.filter((reference) => reference.region !== "Antarctic")
                .map((reference) => {
                    const label = format.countryName(reference.alpha3);
                    const country: SearchCountry = {
                        alpha2: reference.alpha2,
                        code: reference.alpha3,
                        detail: reference.subregion,
                        label,
                    };
                    return createSearchEntry(
                        country,
                        label,
                        getCountrySearchTerms(reference.alpha3),
                        { isCurrent: countryByCode.has(reference.alpha3) }
                    );
                })
                .sort((a, b) => a.item.label.localeCompare(b.item.label)),
        [countryByCode, format]
    );

    const people = useMemo(() => {
        const tripCounts = countTrips(allRecords, (record) => record.officialId);
        return allOfficials.map((official) =>
            createPersonSearchEntry(
                toSearchPerson(official, tripCounts.get(official.id) ?? 0),
                format.countryName(official.countryCode)
            )
        );
    }, [allOfficials, allRecords, format]);

    const chooseCountry = useCallback(
        (country: SearchCountry) =>
            openCountry(country.code, countryByCode.has(country.code) ? "officials" : "inbound"),
        [countryByCode, openCountry]
    );

    const choosePerson = useCallback(
        (person: SearchPerson) => {
            const official = officialById.get(person.id);
            if (!official) {
                return;
            }
            setPanelOpen(true);
            selectOfficial(official);
        },
        [officialById, selectOfficial, setPanelOpen]
    );

    return (
        <SiteSearch
            countries={countries}
            onChooseCountry={chooseCountry}
            onChoosePerson={choosePerson}
            onRetryPeople={retry}
            people={people}
            peopleStatus={status}
        />
    );
}

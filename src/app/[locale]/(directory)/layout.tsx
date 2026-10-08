import { getLocale } from "next-intl/server";

import { CountryNamesProvider } from "@/components/shared/country-names-provider";
import { SiteHeader } from "@/features/leaders/components/site-header";
import { leadersData } from "@/features/leaders/data/leaders-data.server";
import { buildCountryNames } from "@/lib/travel/country-names.server";

/**
 * Pages beside the map (the leaders directory). The document body never scrolls, for the map's
 * sake, so these pages scroll inside their own container below the header.
 */
export default async function DirectoryLayout({ children }: { children: React.ReactNode }) {
    const locale = await getLocale();
    const countries = await leadersData.getCountryList(locale);

    return (
        <CountryNamesProvider names={buildCountryNames(locale)}>
            <div className="flex h-dvh flex-col bg-background">
                <SiteHeader countryCodes={countries.map((country) => country.code)} />
                <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
            </div>
        </CountryNamesProvider>
    );
}

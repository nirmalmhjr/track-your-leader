import { getLocale } from "next-intl/server";

import { SiteHeader } from "@/features/leaders/components/site-header";
import { buildCountryNames } from "@/features/leaders/data/country-names.server";
import { CountryNamesProvider } from "@/features/leaders/hooks/use-directory-format";

/**
 * Pages beside the map (the leaders directory). The document body never scrolls, for the map's
 * sake, so these pages scroll inside their own container below the header.
 */
export default async function DirectoryLayout({ children }: { children: React.ReactNode }) {
    const locale = await getLocale();

    return (
        <CountryNamesProvider names={buildCountryNames(locale)}>
            <div className="flex h-dvh flex-col bg-background">
                <SiteHeader />
                <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
            </div>
        </CountryNamesProvider>
    );
}

import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { CountryRail } from "@/features/leaders/components/country-rail";
import { DirectoryColumns } from "@/features/leaders/components/directory-columns";
import { LandingView } from "@/features/leaders/components/landing-view";
import { leadersData } from "@/features/leaders/data/leaders-data.server";

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations("Leaders.meta");
    const overview = await leadersData.getOverview();
    return {
        description: t("directoryDescription", { countLabel: String(overview.countryCount) }),
        title: t("directoryTitle"),
    };
}

export default async function LeadersPage() {
    const locale = await getLocale();
    const [countries, overview, context] = await Promise.all([
        leadersData.getCountryList(locale),
        leadersData.getOverview(),
        leadersData.getContext(),
    ]);

    return (
        <DirectoryColumns rail={<CountryRail countries={countries} />}>
            <LandingView context={context} overview={overview} />
        </DirectoryColumns>
    );
}

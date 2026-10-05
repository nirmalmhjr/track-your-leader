import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { CountryDirectoryView } from "@/features/leaders/components/country-directory-view";
import { CountryRail } from "@/features/leaders/components/country-rail";
import { DirectoryColumns } from "@/features/leaders/components/directory-columns";
import { buildCountryNames } from "@/features/leaders/data/country-names.server";
import { leadersData } from "@/features/leaders/data/leaders-data.server";
import { parseCountryParam } from "@/features/leaders/utils/leaders.utils";

interface CountryPageProps {
    params: Promise<{ country: string }>;
}

const loadDirectory = async (param: string) => {
    const code = parseCountryParam(param);
    return code ? await leadersData.getCountryDirectory(code) : null;
};

export async function generateMetadata({ params }: CountryPageProps): Promise<Metadata> {
    const directory = await loadDirectory((await params).country);
    if (!directory) {
        return {};
    }
    const [t, locale] = await Promise.all([getTranslations("Leaders.meta"), getLocale()]);
    const country = buildCountryNames(locale)[directory.country.code] ?? directory.country.name;
    return {
        description: t("countryDescription", { country }),
        title: t("countryTitle", { country }),
    };
}

export default async function CountryPage({ params }: CountryPageProps) {
    const directory = await loadDirectory((await params).country);
    if (!directory) {
        notFound();
    }
    const locale = await getLocale();
    const [countries, context] = await Promise.all([
        leadersData.getCountryList(locale),
        leadersData.getContext(),
    ]);

    return (
        <DirectoryColumns
            rail={<CountryRail activeCode={directory.country.code} countries={countries} />}
        >
            <CountryDirectoryView context={context} directory={directory} />
        </DirectoryColumns>
    );
}

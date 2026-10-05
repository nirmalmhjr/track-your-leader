import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { DirectoryColumns } from "@/features/leaders/components/directory-columns";
import { ProfileView } from "@/features/leaders/components/profile-view";
import { buildCountryNames } from "@/features/leaders/data/country-names.server";
import { leadersData } from "@/features/leaders/data/leaders-data.server";
import { parseCountryParam } from "@/features/leaders/utils/leaders.utils";
import { getPrimaryPosition } from "@/features/travel-explorer/utils/filters.utils";
import { summarizeTravel } from "@/features/travel-explorer/utils/travel-aggregates.utils";

interface ProfilePageProps {
    params: Promise<{ country: string; officialId: string }>;
}

const loadProfile = async ({ country, officialId }: { country: string; officialId: string }) => {
    const code = parseCountryParam(country);
    return code ? await leadersData.getOfficialProfile(code, decodeURIComponent(officialId)) : null;
};

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
    const profile = await loadProfile(await params);
    if (!profile) {
        return {};
    }
    const [t, locale] = await Promise.all([getTranslations("Leaders.meta"), getLocale()]);
    const { official, records } = profile;
    const country = buildCountryNames(locale)[official.countryCode] ?? profile.country.name;
    const { tripCount } = summarizeTravel(records);
    const description = t("profileDescription", {
        count: tripCount,
        countLabel: String(tripCount),
        country,
        title: getPrimaryPosition(official).title,
    });
    return {
        description,
        openGraph: {
            description,
            images: official.photoUrl ? [official.photoUrl] : undefined,
            title: official.fullName,
            type: "profile",
        },
        title: official.fullName,
    };
}

export default async function ProfilePage({ params }: ProfilePageProps) {
    const profile = await loadProfile(await params);
    if (!profile) {
        notFound();
    }
    const context = await leadersData.getContext();

    return (
        <DirectoryColumns>
            <ProfileView context={context} profile={profile} />
        </DirectoryColumns>
    );
}

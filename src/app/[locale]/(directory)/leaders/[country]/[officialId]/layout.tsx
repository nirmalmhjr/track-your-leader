import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { leadersData } from "@/features/leaders/data/leaders-data.server";
import { parseCountryParam } from "@/features/leaders/utils/leaders.utils";

interface ProfileLayoutProps {
    children: ReactNode;
    params: Promise<{ country: string; officialId: string }>;
}

/**
 * Rejects unknown officials before the profile streams behind its loading skeleton, so the
 * response carries a real 404 status. Checked against the index alone; the slower country file
 * is read by the page, while the skeleton shows.
 */
export default async function ProfileLayout({ children, params }: ProfileLayoutProps) {
    const { country, officialId } = await params;
    const code = parseCountryParam(country);
    if (!(code && (await leadersData.hasOfficial(code, officialId)))) {
        notFound();
    }
    return children;
}

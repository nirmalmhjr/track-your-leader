import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { leadersData } from "@/features/leaders/data/leaders-data.server";
import { parseCountryParam } from "@/features/leaders/utils/leaders.utils";

interface CountryLayoutProps {
    children: ReactNode;
    params: Promise<{ country: string }>;
}

/**
 * Rejects unknown countries before the pages below start streaming behind their loading
 * skeletons, so the response carries a real 404 status rather than a 200.
 */
export default async function CountryLayout({ children, params }: CountryLayoutProps) {
    const code = parseCountryParam((await params).country);
    if (!(code && (await leadersData.getCountryDirectory(code)))) {
        notFound();
    }
    return children;
}

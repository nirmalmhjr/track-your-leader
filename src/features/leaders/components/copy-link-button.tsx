"use client";

import { IconLink } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/** Copies the current page's address, confirming or reporting the result with a toast. */
export function CopyLinkButton() {
    const t = useTranslations("Leaders.profile");

    const copyLink = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            toast.success(t("copied"));
        } catch {
            // Browsers refuse clipboard access without permission or outside secure contexts.
            toast.error(t("copyFailed"));
        }
    }, [t]);

    return (
        <Button onClick={copyLink} size="sm" variant="ghost">
            <IconLink data-icon="inline-start" />
            {t("copyLink")}
        </Button>
    );
}

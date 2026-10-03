"use client";

import { IconMenu2 } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { useCallback } from "react";

import { Button } from "@/components/ui/button";
import { EXPLORER_PANEL_ID } from "@/features/travel-explorer/constants/explorer.constants";
import { useExplorerUiStore } from "@/stores/explorer-ui-store";

/**
 * Menu button in the top-right corner of the map, just below the header, shown while the
 * exploration panel is hidden. Opening the panel slides it in from the right.
 */
export function PanelToggle() {
    const t = useTranslations("Explorer.panel");
    const setPanelOpen = useExplorerUiStore((state) => state.setPanelOpen);
    const openPanel = useCallback(() => setPanelOpen(true), [setPanelOpen]);

    return (
        <Button
            aria-controls={EXPLORER_PANEL_ID}
            aria-expanded={false}
            aria-label={t("expand")}
            className="fade-in-0 slide-in-from-right-2 absolute top-3 right-3 z-20 animate-in shadow-md duration-300"
            onClick={openPanel}
            size="icon"
            variant="outline"
        >
            <IconMenu2 />
        </Button>
    );
}

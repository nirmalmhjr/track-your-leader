"use client";

import { IconMountain } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { useCallback } from "react";

import { Toggle } from "@/components/ui/toggle";
import { useExplorerUiStore } from "@/stores/explorer-ui-store";

/** Switches the map between its flat look and the terrain imagery. */
export function MapStyleToggle() {
    const t = useTranslations("Explorer.map.controls");
    const mapStyle = useExplorerUiStore((state) => state.mapStyle);
    const setMapStyle = useExplorerUiStore((state) => state.setMapStyle);
    const handlePressedChange = useCallback(
        (isPressed: boolean) => setMapStyle(isPressed ? "terrain" : "simple"),
        [setMapStyle]
    );

    return (
        <Toggle
            className="bg-card shadow-md"
            onPressedChange={handlePressedChange}
            pressed={mapStyle === "terrain"}
            size="sm"
            variant="outline"
        >
            <IconMountain />
            {t("terrain")}
        </Toggle>
    );
}

import { create } from "zustand";

import type { SheetSnapPoint } from "@/features/travel-explorer/types/explorer.types";
import type { CountryCode } from "@/types/geo.types";

interface ExplorerUiState {
    /** Clears every hover highlight, e.g. when navigation unmounts the hovered element. */
    clearHover: () => void;
    /** Country highlighted on the map while hovering it in the panel. */
    hoveredCountry: CountryCode | null;
    /** Official whose routes are emphasised while hovering their card. */
    hoveredOfficialId: string | null;
    /** Trip whose route is emphasised while hovering it in a timeline. */
    hoveredRecordId: string | null;
    isFiltersOpen: boolean;
    /** Tablet only: whether the floating panel is tucked away. */
    isPanelCollapsed: boolean;
    setFiltersOpen: (isOpen: boolean) => void;
    setHoveredCountry: (code: CountryCode | null) => void;
    setHoveredOfficialId: (id: string | null) => void;
    setHoveredRecordId: (id: string | null) => void;
    setPanelCollapsed: (isCollapsed: boolean) => void;
    setSheetSnap: (snap: SheetSnapPoint) => void;
    /** Phone only: height of the bottom sheet. */
    sheetSnap: SheetSnapPoint;
}

/** Ephemeral UI state shared between the map and the exploration panel. */
export const useExplorerUiStore = create<ExplorerUiState>()((set) => ({
    clearHover: () => set({ hoveredCountry: null, hoveredOfficialId: null, hoveredRecordId: null }),
    hoveredCountry: null,
    hoveredOfficialId: null,
    hoveredRecordId: null,
    isFiltersOpen: false,
    isPanelCollapsed: false,
    setFiltersOpen: (isFiltersOpen) => set({ isFiltersOpen }),
    setHoveredCountry: (hoveredCountry) => set({ hoveredCountry }),
    setHoveredOfficialId: (hoveredOfficialId) => set({ hoveredOfficialId }),
    setHoveredRecordId: (hoveredRecordId) => set({ hoveredRecordId }),
    setPanelCollapsed: (isPanelCollapsed) => set({ isPanelCollapsed }),
    setSheetSnap: (sheetSnap) => set({ sheetSnap }),
    sheetSnap: "peek",
}));

import { create } from "zustand";

import type {
    CountrySort,
    FormerLayout,
    SheetSnap,
} from "@/features/travel-explorer/types/explorer.types";
import { raiseSheetSnap } from "@/features/travel-explorer/utils/sheet-snap.utils";
import type { CountryCode } from "@/types/geo.types";

interface ExplorerUiState {
    /** Clears every hover highlight, e.g. when navigation unmounts the hovered element. */
    clearHover: () => void;
    /** Order of the overview country index, kept while navigating in and out of countries. */
    countrySort: CountrySort;
    /** How a country's former officials are laid out, kept from one country to the next. */
    formerLayout: FormerLayout;
    /** Country highlighted on the map while hovering it in the panel. */
    hoveredCountry: CountryCode | null;
    /** Official whose routes are emphasised while hovering their card. */
    hoveredOfficialId: string | null;
    /** Trip whose route is emphasised while hovering it in a timeline. */
    hoveredRecordId: string | null;
    isFiltersOpen: boolean;
    /**
     * Whether the side drawer (tablets and up) is showing; hidden, the map gets the whole screen.
     */
    isPanelOpen: boolean;
    setCountrySort: (sort: CountrySort) => void;
    setFiltersOpen: (isOpen: boolean) => void;
    setFormerLayout: (layout: FormerLayout) => void;
    setHoveredCountry: (code: CountryCode | null) => void;
    setHoveredOfficialId: (id: string | null) => void;
    setHoveredRecordId: (id: string | null) => void;
    /** Opens or hides the panel: the side drawer shows or hides, the bottom sheet rises or peeks. */
    setPanelOpen: (isOpen: boolean) => void;
    setSheetCoverPx: (coverPx: number) => void;
    setSheetSnap: (snap: SheetSnap) => void;
    /** Height of the map (px) the resting bottom sheet covers, so the map frames above it. */
    sheetCoverPx: number;
    /** How far the bottom sheet (phones) is pulled up. */
    sheetSnap: SheetSnap;
}

/** Ephemeral UI state shared between the map and the exploration panel. */
export const useExplorerUiStore = create<ExplorerUiState>()((set) => ({
    clearHover: () => set({ hoveredCountry: null, hoveredOfficialId: null, hoveredRecordId: null }),
    countrySort: "name",
    formerLayout: "position",
    hoveredCountry: null,
    hoveredOfficialId: null,
    hoveredRecordId: null,
    isFiltersOpen: false,
    isPanelOpen: true,
    setCountrySort: (countrySort) => set({ countrySort }),
    // The filters open inside the panel, so a peeking sheet rises to show them.
    setFiltersOpen: (isFiltersOpen) =>
        set((state) =>
            isFiltersOpen
                ? { isFiltersOpen, sheetSnap: raiseSheetSnap(state.sheetSnap) }
                : { isFiltersOpen }
        ),
    setFormerLayout: (formerLayout) => set({ formerLayout }),
    setHoveredCountry: (hoveredCountry) => set({ hoveredCountry }),
    setHoveredOfficialId: (hoveredOfficialId) => set({ hoveredOfficialId }),
    setHoveredRecordId: (hoveredRecordId) => set({ hoveredRecordId }),
    setPanelOpen: (isPanelOpen) =>
        set((state) => ({
            isPanelOpen,
            sheetSnap: isPanelOpen ? raiseSheetSnap(state.sheetSnap) : "peek",
        })),
    setSheetCoverPx: (sheetCoverPx) => set({ sheetCoverPx }),
    setSheetSnap: (sheetSnap) => set({ sheetSnap }),
    sheetCoverPx: 0,
    sheetSnap: "peek",
}));

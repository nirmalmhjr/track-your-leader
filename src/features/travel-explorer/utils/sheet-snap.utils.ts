import {
    SHEET_FLICK_VELOCITY,
    SHEET_HALF_RATIO,
    SHEET_SNAPS,
} from "@/features/travel-explorer/constants/explorer.constants";
import type { SheetSnap, SheetSnapOffsets } from "@/features/travel-explorer/types/explorer.types";

/** Where a tap on the sheet's handle takes it: up a step, and back down from the top. */
const NEXT_SNAP: Record<SheetSnap, SheetSnap> = { full: "peek", half: "full", peek: "half" };

/**
 * Works out how far down the sheet sits at each snap.
 *
 * @param sheetHeight - Height of the fully open sheet (px).
 * @param peekHeight - Height left showing at the peek snap (px).
 * @returns Offsets from fully open; half never sits below peek on very short screens.
 */
export const getSheetSnapOffsets = (sheetHeight: number, peekHeight: number): SheetSnapOffsets => {
    const peek = Math.max(sheetHeight - peekHeight, 0);
    return {
        full: 0,
        half: Math.min(Math.round(sheetHeight * (1 - SHEET_HALF_RATIO)), peek),
        peek,
    };
};

/**
 * Picks where a released sheet settles: the next snap in the direction of a flick, otherwise the
 * snap nearest to where it was let go.
 *
 * @param offsets - Offset of each snap.
 * @param offset - Offset at release (px).
 * @param velocity - Speed at release (px/ms), positive downwards.
 * @returns The snap to settle on.
 */
export const pickSheetSnap = (
    offsets: SheetSnapOffsets,
    offset: number,
    velocity: number
): SheetSnap => {
    if (velocity > SHEET_FLICK_VELOCITY) {
        return SHEET_SNAPS.find((snap) => offsets[snap] > offset) ?? "peek";
    }
    if (velocity < -SHEET_FLICK_VELOCITY) {
        return SHEET_SNAPS.findLast((snap) => offsets[snap] < offset) ?? "full";
    }
    let nearest: SheetSnap = "peek";
    for (const snap of SHEET_SNAPS) {
        if (Math.abs(offsets[snap] - offset) < Math.abs(offsets[nearest] - offset)) {
            nearest = snap;
        }
    }
    return nearest;
};

/**
 * @param snap - Current snap.
 * @returns The snap a tap on the handle moves to.
 */
export const getNextSheetSnap = (snap: SheetSnap): SheetSnap => NEXT_SNAP[snap];

/**
 * @param snap - Current snap.
 * @returns The snap that shows the panel's content: a peeking sheet rises to half height.
 */
export const raiseSheetSnap = (snap: SheetSnap): SheetSnap => (snap === "peek" ? "half" : snap);

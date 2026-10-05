"use client";

import { useCallback } from "react";

import type { SheetSnapOffsets } from "@/features/travel-explorer/types/explorer.types";
import { pickSheetSnap } from "@/features/travel-explorer/utils/sheet-snap.utils";
import { type DragRelease, useDragGesture } from "@/hooks/use-drag-gesture";
import { useExplorerUiStore } from "@/stores/explorer-ui-store";

/**
 * Drag-to-resize for the phone bottom sheet: the finger moves it between fully open and peeking,
 * and on release it settles on a snap.
 *
 * @param offsets - Offset of each snap, from the sheet's measured size.
 * @returns Pointer handlers for the sheet's header and its live offset (px) while dragging.
 */
export function useSheetDrag(offsets: SheetSnapOffsets) {
    const sheetSnap = useExplorerUiStore((state) => state.sheetSnap);
    const setSheetSnap = useExplorerUiStore((state) => state.setSheetSnap);
    const restingOffset = offsets[sheetSnap];

    const clampOffset = useCallback(
        (offset: number) => Math.min(Math.max(offset, offsets.full), offsets.peek),
        [offsets]
    );

    const handleRelease = useCallback(
        ({ delta, velocity }: DragRelease) => {
            setSheetSnap(pickSheetSnap(offsets, clampOffset(restingOffset + delta), velocity));
        },
        [offsets, clampOffset, restingOffset, setSheetSnap]
    );

    const { dragDelta, handlers } = useDragGesture("y", handleRelease);

    return {
        dragOffsetY: dragDelta === null ? null : clampOffset(restingOffset + dragDelta),
        handlers,
    };
}

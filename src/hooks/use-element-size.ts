"use client";

import { useEffect, useState } from "react";

export interface ElementSize {
    height: number;
    width: number;
}

const EMPTY_SIZE: ElementSize = { height: 0, width: 0 };

/**
 * Tracks the rendered size of an element with a `ResizeObserver`.
 *
 * @returns A callback ref to attach to the element and its latest content-box size.
 */
export function useElementSize<T extends HTMLElement>(): readonly [
    (element: T | null) => void,
    ElementSize,
] {
    const [element, setElement] = useState<T | null>(null);
    const [size, setSize] = useState<ElementSize>(EMPTY_SIZE);

    useEffect(() => {
        if (!element) {
            return;
        }

        const observer = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect;
            setSize((previous) =>
                previous.width === width && previous.height === height
                    ? previous
                    : { height, width }
            );
        });

        observer.observe(element);
        return () => observer.disconnect();
    }, [element]);

    return [setElement, size] as const;
}

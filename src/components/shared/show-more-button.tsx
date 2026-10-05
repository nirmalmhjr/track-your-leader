"use client";

import { useEffect, useEffectEvent, useRef } from "react";

import { Button } from "@/components/ui/button";

/** How far ahead of the visible area the next page starts rendering. */
const PRELOAD_MARGIN_PX = 800;

const findScrollParent = (node: Element): Element | null => {
    for (let element = node.parentElement; element; element = element.parentElement) {
        const { overflowY } = getComputedStyle(element);
        if (overflowY === "auto" || overflowY === "scroll") {
            return element;
        }
    }
    return null;
};

interface ShowMoreButtonProps {
    label: string;
    onShowMore: () => void;
    /** How many items are showing; each change checks again whether the end is in reach. */
    shownCount: number;
}

/**
 * Reveals the next page of a long list. It presses itself as it scrolls into reach, so long
 * lists render a page at a time while scrolling stays seamless, and it stays a real button for
 * keyboard and screen reader users.
 */
export function ShowMoreButton({ label, onShowMore, shownCount }: ShowMoreButtonProps) {
    const ref = useRef<HTMLButtonElement>(null);
    const showMore = useEffectEvent(onShowMore);

    // biome-ignore lint/correctness/useExhaustiveDependencies: Observing again after each page reports whether the end is still in reach.
    useEffect(() => {
        const node = ref.current;
        if (!node) {
            return;
        }
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    showMore();
                }
            },
            { root: findScrollParent(node), rootMargin: `0px 0px ${PRELOAD_MARGIN_PX}px 0px` }
        );
        observer.observe(node);
        return () => observer.disconnect();
    }, [shownCount]);

    return (
        <Button className="w-full" onClick={onShowMore} ref={ref} size="sm" variant="ghost">
            {label}
        </Button>
    );
}

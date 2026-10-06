import { IconChevronRight } from "@tabler/icons-react";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

interface StatTile {
    /** Makes the whole tile a link, e.g. to the matching tab of the page. */
    href?: string;
    label: string;
    value: string;
}

/** Headline figures as a row of tiles: two across on phones, all in one row from tablets up. */
export function StatTiles({
    items,
    className,
}: {
    items: readonly StatTile[];
    className?: string;
}) {
    return (
        <dl
            className={cn(
                "grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border",
                items.length === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3",
                className
            )}
        >
            {items.map((item) => (
                <div
                    className="relative flex min-w-0 flex-col gap-1 bg-card px-4 py-3 transition-colors has-[a:hover]:bg-accent/50"
                    key={item.label}
                >
                    <dt className="flex min-w-0 items-center gap-0.5 text-muted-foreground text-xs">
                        <span className="truncate">{item.label}</span>
                        {item.href ? <IconChevronRight aria-hidden className="size-3" /> : null}
                    </dt>
                    <dd className="font-semibold text-2xl leading-none tracking-tight">
                        {item.href ? (
                            // The overlay stretches the link over the whole tile.
                            <Link
                                aria-label={`${item.label}: ${item.value}`}
                                className="outline-none after:absolute after:inset-0 focus-visible:after:ring-3 focus-visible:after:ring-ring/50 focus-visible:after:ring-inset"
                                href={item.href}
                            >
                                {item.value}
                            </Link>
                        ) : (
                            item.value
                        )}
                    </dd>
                </div>
            ))}
        </dl>
    );
}

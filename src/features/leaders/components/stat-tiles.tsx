import { cn } from "@/lib/utils";

interface StatTile {
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
                <div className="flex min-w-0 flex-col gap-1 bg-card px-4 py-3" key={item.label}>
                    <dt className="truncate text-muted-foreground text-xs">{item.label}</dt>
                    <dd className="font-semibold text-2xl leading-none tracking-tight">
                        {item.value}
                    </dd>
                </div>
            ))}
        </dl>
    );
}

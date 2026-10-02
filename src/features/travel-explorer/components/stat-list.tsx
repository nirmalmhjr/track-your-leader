import { cn } from "@/lib/utils";

interface StatItem {
    label: string;
    value: string;
}

/** Compact row of headline figures. */
export function StatList({ items, className }: { items: readonly StatItem[]; className?: string }) {
    return (
        <dl
            className={cn(
                "grid divide-x rounded-lg border",
                items.length === 4 ? "grid-cols-4" : "grid-cols-3",
                className
            )}
        >
            {items.map((item) => (
                <div className="flex min-w-0 flex-col gap-0.5 px-3 py-2" key={item.label}>
                    <dt className="truncate text-[11px] text-muted-foreground">{item.label}</dt>
                    <dd className="font-semibold text-base tabular-nums leading-tight">
                        {item.value}
                    </dd>
                </div>
            ))}
        </dl>
    );
}

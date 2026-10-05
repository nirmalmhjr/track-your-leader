import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SectionHeadingProps {
    /** Controls aligned to the right, such as a layout switch. */
    actions?: ReactNode;
    caption?: ReactNode;
    className?: string;
    id: string;
    title: ReactNode;
}

/** Heading of a page section with an optional muted caption and right-aligned controls. */
export function SectionHeading({ id, title, caption, actions, className }: SectionHeadingProps) {
    return (
        <div className={cn("flex flex-wrap items-end justify-between gap-x-4 gap-y-2", className)}>
            <div className="flex min-w-0 flex-col gap-0.5">
                <h2 className="font-semibold text-lg tracking-tight" id={id}>
                    {title}
                </h2>
                {caption ? <p className="text-muted-foreground text-sm">{caption}</p> : null}
            </div>
            {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
    );
}

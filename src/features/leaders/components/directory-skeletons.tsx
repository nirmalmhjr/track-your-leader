import { Skeleton } from "@/components/ui/skeleton";

/** Leader cards shown while a directory page loads. */
const CARD_PLACEHOLDERS = 6;
/** Country rows shown while the rail loads. */
const RAIL_PLACEHOLDERS = 14;
/** Trip log entries shown while a profile loads. */
const TRIP_PLACEHOLDERS = 4;

const keys = (count: number): string[] => Array.from({ length: count }, (_, index) => `${index}`);

function HeroSkeleton() {
    return (
        <div className="flex flex-col gap-6 rounded-2xl border bg-card p-6 md:p-8">
            <div className="flex items-center gap-4">
                <Skeleton className="size-14 rounded-xl" />
                <div className="flex flex-1 flex-col gap-2">
                    <Skeleton className="h-8 w-1/3" />
                    <Skeleton className="h-4 w-1/2" />
                </div>
            </div>
            <Skeleton className="h-16 w-full rounded-xl" />
        </div>
    );
}

function CardGridSkeleton() {
    return (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {keys(CARD_PLACEHOLDERS).map((key) => (
                <Skeleton className="h-36 rounded-xl" key={key} />
            ))}
        </div>
    );
}

/** Placeholder for pages with the country rail: the landing page and country pages. */
export function DirectorySkeleton() {
    return (
        <div className="flex min-h-full flex-col md:flex-row">
            <div className="hidden flex-col gap-2 border-r p-3 md:flex md:w-72 lg:w-80">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="mb-2 h-8 w-full" />
                {keys(RAIL_PLACEHOLDERS).map((key) => (
                    <Skeleton className="h-7 w-full" key={key} />
                ))}
            </div>
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-6 md:px-8 md:py-10">
                <HeroSkeleton />
                <CardGridSkeleton />
            </div>
        </div>
    );
}

/** Placeholder for a profile page. */
export function ProfileSkeleton() {
    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-6 md:px-8 md:py-10">
            <Skeleton className="h-4 w-64" />
            <HeroSkeleton />
            <div className="grid gap-10 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
                <Skeleton className="h-48 rounded-xl" />
                <div className="flex flex-col gap-3">
                    <Skeleton className="h-56 rounded-xl" />
                    {keys(TRIP_PLACEHOLDERS).map((key) => (
                        <Skeleton className="h-16 rounded-xl" key={key} />
                    ))}
                </div>
            </div>
        </div>
    );
}

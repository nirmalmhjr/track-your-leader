import type { ReactNode } from "react";

/** The directory's columns: the country rail, when the page has one, and the content beside it. */
export function DirectoryColumns({ rail, children }: { rail?: ReactNode; children: ReactNode }) {
    return (
        <div className="flex min-h-full flex-col md:flex-row">
            {rail}
            <main className="min-w-0 flex-1">
                <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-6 md:px-8 md:py-10">
                    {children}
                </div>
            </main>
        </div>
    );
}

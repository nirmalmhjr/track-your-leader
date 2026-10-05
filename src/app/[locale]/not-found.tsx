"use client";

import { useCallback } from "react";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/configs/routes";
import { useRouter } from "@/i18n/navigation";

export default function NotFound() {
    const router = useRouter();
    const goBack = useCallback(() => router.back(), [router]);
    const goHome = useCallback(() => router.push(ROUTES.HOME), [router]);

    return (
        <div className="absolute top-1/2 left-1/2 mb-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center text-center">
            <span className="bg-linear-to-b from-foreground to-transparent bg-clip-text font-extrabold text-[10rem] text-transparent leading-none">
                404
            </span>
            <h2 className="my-2 font-bold font-heading text-2xl">Something&apos;s missing</h2>
            <p>Sorry, the page you are looking for doesn&apos;t exist or has been moved.</p>
            <div className="mt-8 flex justify-center gap-2">
                <Button onClick={goBack} size="lg" variant="default">
                    Go back
                </Button>
                <Button onClick={goHome} size="lg" variant="ghost">
                    Back to Home
                </Button>
            </div>
        </div>
    );
}

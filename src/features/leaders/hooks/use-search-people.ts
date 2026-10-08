"use client";

import { useCallback, useEffect, useState } from "react";

import type { SearchPeopleStatus } from "@/components/shared/site-search";
import { travelDataClient } from "@/features/travel-explorer/data/travel-data-client";
import { toIsoDate } from "@/lib/travel/date.utils";
import type { SearchPerson } from "@/types/travel.types";

interface SearchPeople {
    people: readonly SearchPerson[];
    /** Starts loading, once; later calls do nothing until a failure is retried. */
    prepare: () => void;
    retry: () => void;
    status: SearchPeopleStatus | "idle";
}

/**
 * Everyone the directory's header search lists. The file is a few hundred kilobytes, so nothing
 * is fetched until the search is about to be used.
 *
 * @returns The people, the loading status, and the functions that start or retry loading.
 */
export function useSearchPeople(): SearchPeople {
    const [attempt, setAttempt] = useState(0);
    const [status, setStatus] = useState<SearchPeople["status"]>("idle");
    const [people, setPeople] = useState<readonly SearchPerson[]>([]);

    const prepare = useCallback(() => setAttempt((count) => count || 1), []);
    const retry = useCallback(() => setAttempt((count) => count + 1), []);

    useEffect(() => {
        if (attempt === 0) {
            return;
        }
        const controller = new AbortController();
        setStatus("loading");
        travelDataClient
            .getSearchPeople(toIsoDate(new Date()), controller.signal)
            .then((loaded) => {
                setPeople(loaded);
                setStatus("ready");
            })
            .catch(() => {
                if (!controller.signal.aborted) {
                    setStatus("error");
                }
            });
        return () => controller.abort();
    }, [attempt]);

    return { people, prepare, retry, status };
}

"use client";

import { useCallback, useEffect, useState } from "react";

import { travelDataClient } from "@/features/travel-explorer/data/travel-data-client";
import type { CountryCode } from "@/types/geo.types";
import type { Official } from "@/types/travel.types";

export type PeopleStatus = "idle" | "loading" | "ready" | "error";

interface CountryPeople {
    load: () => void;
    people: readonly Official[];
    status: PeopleStatus;
}

/**
 * Everyone else on record for a country (legislators, judges, diplomats… without trips). The
 * file can be large, so nothing is fetched until `load` is called.
 *
 * @param code - Country whose people to load.
 * @returns The people, the loading status and the function that starts (or retries) loading.
 */
export function useCountryPeople(code: CountryCode): CountryPeople {
    const [attempt, setAttempt] = useState(0);
    const [status, setStatus] = useState<PeopleStatus>("idle");
    const [people, setPeople] = useState<readonly Official[]>([]);

    const load = useCallback(() => setAttempt((count) => count + 1), []);

    useEffect(() => {
        if (attempt === 0) {
            return;
        }
        const controller = new AbortController();
        setStatus("loading");
        travelDataClient
            .getPeople(code, controller.signal)
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
    }, [attempt, code]);

    return { load, people, status };
}

import type { IsoDate } from "@/features/travel-explorer/types/travel.types";
import type { CountryCode } from "@/types/geo.types";

import { COUNTRY_SOURCES } from "../config";
import { log } from "../lib/log";
import { formatCiaName, isSameName } from "../lib/text";
import { type CiaCabinet, fetchCiaCabinet } from "../sources/cia-world-leaders";
import { classifyTitle } from "./roles";

/**
 * Reads each country's current cabinet from the CIA World Leaders list. Heads of state and
 * government come from Wikidata instead (it has full term dates), so here they only serve to
 * detect lists the CIA hasn't updated since a change of government.
 */

export type CabinetStatus = "ok" | "stale" | "unavailable" | "not-covered";

export interface CabinetMember {
    name: string;
    /** Expanded titles, e.g. "Minister of Foreign Affairs". */
    titles: string[];
}

export interface CabinetResult {
    asOf: IsoDate | null;
    members: CabinetMember[];
    status: CabinetStatus;
    url: string | null;
}

interface CurrentLeader {
    name: string;
    startDate: IsoDate | null;
}

const isLeaderTitle = (title: string): boolean => {
    const { categories } = classifyTitle(title);
    return categories.includes("head_of_state") || categories.includes("head_of_government");
};

/**
 * A cabinet list is stale when its leader differs from Wikidata's current leader and the CIA
 * last updated the page before that leader took office. Monarchs of Commonwealth realms are
 * not tracked, so only heads of government are compared there.
 */
const isStale = (
    cabinet: CiaCabinet,
    leaders: readonly CurrentLeader[],
    includeHeadOfState: boolean
): boolean => {
    const listed = cabinet.entries.filter((entry) => {
        const { categories } = classifyTitle(entry.title);
        return (
            categories.includes("head_of_government") ||
            (includeHeadOfState && categories.includes("head_of_state"))
        );
    });
    const hasUnknownLeader = listed.some(
        (entry) => !leaders.some((leader) => isSameName(entry.name, leader.name))
    );
    const newestLeaderStart = leaders
        .map((leader) => leader.startDate ?? "")
        .sort()
        .at(-1);
    return (
        hasUnknownLeader && newestLeaderStart !== undefined && newestLeaderStart > cabinet.updatedOn
    );
};

const groupMembers = (cabinet: CiaCabinet): CabinetMember[] => {
    const members: CabinetMember[] = [];
    for (const entry of cabinet.entries) {
        const role = classifyTitle(entry.title);
        if (!role.isTracked || isLeaderTitle(entry.title)) {
            continue;
        }
        const name = formatCiaName(entry.name);
        const existing = members.find((member) => isSameName(member.name, name));
        if (existing) {
            existing.titles.push(role.title);
        } else {
            members.push({ name, titles: [role.title] });
        }
    }
    return members;
};

/**
 * Fetches and filters one country's cabinet.
 *
 * @param code - Country code.
 * @param leaders - Wikidata's current heads of state and government for that country.
 * @returns Members (ministers, deputies, senior officials) and the list's status.
 */
export const extractCabinet = async (
    code: CountryCode,
    leaders: readonly CurrentLeader[]
): Promise<CabinetResult> => {
    const source = COUNTRY_SOURCES[code];
    const slug = source?.ciaSlug;
    if (!slug) {
        return { asOf: null, members: [], status: "not-covered", url: null };
    }

    let cabinet: CiaCabinet;
    try {
        cabinet = await fetchCiaCabinet(slug);
    } catch (error) {
        log.warn(`CIA cabinet for ${code} unavailable: ${(error as Error).message}`);
        return { asOf: null, members: [], status: "unavailable", url: null };
    }

    if (isStale(cabinet, leaders, source.includeHeadOfState)) {
        log.warn(
            `CIA cabinet for ${code} predates the current leader (as of ${cabinet.updatedOn})`
        );
        return { asOf: cabinet.updatedOn, members: [], status: "stale", url: cabinet.url };
    }
    return {
        asOf: cabinet.updatedOn,
        members: groupMembers(cabinet),
        status: "ok",
        url: cabinet.url,
    };
};

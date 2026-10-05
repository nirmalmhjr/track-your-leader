import { z } from "zod";

import { fetchJson, withQuery } from "../lib/http";

/**
 * The House of Commons Register of Members' Financial Interests, through Parliament's interests
 * API: every MP must register visits outside the UK that others paid for, with the countries,
 * dates and purpose. Open Parliament Licence.
 */

const ENDPOINT = "https://interests-api.parliament.uk/api/v1/Interests";
/** Category 4 of the register, "Visits outside the UK". */
const VISITS_CATEGORY = "5";
/** The API's page size. */
const PAGE_SIZE = 20;
export const UK_REGISTER_URL =
    "https://www.parliament.uk/mps-lords-and-offices/standards-and-financial-interests/parliamentary-commissioner-for-standards/registers-of-interests/register-of-members-financial-interests/";

const fieldSchema: z.ZodType<RegisterField> = z.lazy(() =>
    z.object({
        name: z.string(),
        value: z.unknown().optional(),
        values: z.array(z.array(fieldSchema)).nullable().optional(),
    })
);

interface RegisterField {
    name: string;
    value?: unknown;
    values?: RegisterField[][] | null;
}

const pageSchema = z.object({
    items: z.array(
        z.object({
            fields: z.array(fieldSchema),
            id: z.number(),
            member: z.object({
                house: z.string(),
                memberFrom: z.string().nullable(),
                nameDisplayAs: z.string(),
            }),
        })
    ),
    totalResults: z.number(),
});

export interface MemberVisit {
    /** Countries visited, each with the places within it, when given. */
    destinations: { city: string | null; country: string }[];
    endDate: string | null;
    id: number;
    member: string;
    /** Constituency. */
    memberFrom: string | null;
    purpose: string | null;
    startDate: string | null;
}

const text = (fields: readonly RegisterField[], name: string): string | null => {
    const value = fields.find((field) => field.name === name)?.value;
    return typeof value === "string" && value.trim() ? value.trim() : null;
};

/**
 * Every visit outside the UK that sitting MPs registered.
 *
 * @returns The visits.
 */
export const fetchMemberVisits = async (): Promise<MemberVisit[]> => {
    const visits: MemberVisit[] = [];
    let skip = 0;
    let total = Number.POSITIVE_INFINITY;
    while (skip < total) {
        const page = pageSchema.parse(
            // biome-ignore lint/performance/noAwaitInLoops: each page is requested after the previous one.
            await fetchJson(
                withQuery(ENDPOINT, {
                    CategoryId: VISITS_CATEGORY,
                    Skip: String(skip),
                    Take: String(PAGE_SIZE),
                })
            )
        );
        total = page.totalResults;
        for (const item of page.items) {
            const locations = item.fields.find((field) => field.name === "VisitLocations");
            visits.push({
                destinations: (locations?.values ?? []).flatMap((location) => {
                    const country = text(location, "Country");
                    return country ? [{ city: text(location, "Destination"), country }] : [];
                }),
                endDate: text(item.fields, "EndDate"),
                id: item.id,
                member: item.member.nameDisplayAs,
                memberFrom: item.member.memberFrom,
                purpose: text(item.fields, "Purpose"),
                startDate: text(item.fields, "StartDate"),
            });
        }
        skip += PAGE_SIZE;
        if (page.items.length === 0) {
            break;
        }
    }
    return visits;
};

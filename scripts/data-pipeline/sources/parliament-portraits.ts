/**
 * Official parliamentary portraits, by the identifiers Wikidata records for members:
 * - US Congress (Bioguide id, `P1157`): the `unitedstates/images` collection, public domain
 *   (works of the US government).
 * - UK Parliament (parliament.uk member id, `P10428`): the Members API thumbnail, which
 *   Parliament publishes under an open licence (CC BY 3.0).
 * Only people without another free photo get one.
 */

export const US_CONGRESS_ID = "P1157";
export const UK_PARLIAMENT_ID = "P10428";

const US_PORTRAIT = (bioguide: string): string =>
    `https://unitedstates.github.io/images/congress/225x275/${encodeURIComponent(bioguide)}.jpg`;
const UK_PORTRAIT = (memberId: string): string =>
    `https://members-api.parliament.uk/api/Members/${encodeURIComponent(memberId)}/Thumbnail`;

const BIOGUIDE = /^[A-Z]\d{6}$/;
const MEMBER_ID = /^\d+$/;

/**
 * A member's official portrait.
 *
 * @param ids - The person's US Congress and UK Parliament ids, when Wikidata has them.
 * @returns The portrait's address, or `null` for someone who sat in neither.
 */
export const parliamentPortrait = ({
    ukParliament,
    usCongress,
}: {
    ukParliament?: string | null;
    usCongress?: string | null;
}): string | null => {
    if (usCongress && BIOGUIDE.test(usCongress)) {
        return US_PORTRAIT(usCongress);
    }
    return ukParliament && MEMBER_ID.test(ukParliament) ? UK_PORTRAIT(ukParliament) : null;
};

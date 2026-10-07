import { chunk } from "../lib/collections";
import { log } from "../lib/log";
import {
    parliamentPortrait,
    UK_PARLIAMENT_ID,
    US_CONGRESS_ID,
} from "../sources/parliament-portraits";
import { runQlever } from "../sources/qlever";
import { commonsImageUrl } from "../sources/wikidata";
import { fetchPageImages, PHOTO_LANGUAGES, type PhotoLanguage } from "../sources/wikipedia";
import type { PersonInfo } from "./people.extract";

/**
 * Photos for the people store's members Wikidata has none for: the free lead image of their
 * article on the first Wikipedia (in `PHOTO_LANGUAGES` order) that has one, else their official
 * parliamentary portrait (US Congress, UK Parliament).
 */

const BATCH_SIZE = 1000;
const PHOTO_WIDTH = 160;
const LOOKUP_TTL_HOURS = 6 * 24;
/** "https://fr.wikipedia.org/": a Wikipedia's language code. */
const WIKIPEDIA_SITE = /^https:\/\/([a-z-]+)\.wikipedia\.org\/$/;

const values = (ids: readonly string[]): string => ids.map((id) => `wd:${id}`).join(" ");

interface Leads {
    /** Article title → person, per Wikipedia. */
    articles: Map<string, Map<string, string>>;
    /** Portrait address per person. */
    portraits: Map<string, string>;
}

/** Each person's articles on the photo Wikipedias, and their parliamentary ids. */
const fetchLeads = async (ids: readonly string[]): Promise<Leads> => {
    const sites = PHOTO_LANGUAGES.map((language) => `<https://${language}.wikipedia.org/>`).join(
        ", "
    );
    const leads: Leads = { articles: new Map(), portraits: new Map() };
    for (const batch of chunk(ids, BATCH_SIZE)) {
        // biome-ignore lint/performance/noAwaitInLoops: one query at a time keeps QLever happy.
        const rows = await runQlever(
            `SELECT ?person ?site ?title ?us ?uk WHERE {
                VALUES ?person { ${values(batch)} }
                OPTIONAL { ?article schema:about ?person ; schema:isPartOf ?site ; schema:name ?title
                    FILTER(?site IN (${sites})) }
                OPTIONAL { ?person wdt:${US_CONGRESS_ID} ?us }
                OPTIONAL { ?person wdt:${UK_PARLIAMENT_ID} ?uk }
            }`,
            LOOKUP_TTL_HOURS
        );
        for (const row of rows) {
            if (!row.person) {
                continue;
            }
            const language = row.site?.match(WIKIPEDIA_SITE)?.[1];
            if (language && row.title) {
                const byTitle = leads.articles.get(language) ?? new Map<string, string>();
                leads.articles.set(language, byTitle.set(row.title, row.person));
            }
            const portrait = parliamentPortrait({ ukParliament: row.uk, usCongress: row.us });
            if (portrait) {
                leads.portraits.set(row.person, portrait);
            }
        }
    }
    return leads;
};

/** Lead images from one Wikipedia for those still without a photo. */
const addLeadImages = async (
    people: ReadonlyMap<string, PersonInfo>,
    language: PhotoLanguage,
    byTitle: ReadonlyMap<string, string>
): Promise<void> => {
    const wanted = [...byTitle].filter(([, id]) => !people.get(id)?.photoUrl);
    if (wanted.length === 0) {
        return;
    }
    // A Wikipedia that fails only costs its photos, never the run.
    const images = await fetchPageImages(
        wanted.map(([title]) => title),
        language
    ).catch((error: unknown) => {
        log.warn(`Lead images from ${language}.wikipedia.org failed: ${(error as Error).message}`);
        return new Map<string, string>();
    });
    for (const [title, id] of wanted) {
        const file = images.get(title);
        const person = people.get(id);
        if (file && person) {
            person.photoUrl = commonsImageUrl(file, PHOTO_WIDTH);
        }
    }
};

/**
 * Fills in photos for people without one.
 *
 * @param people - People found; updated in place.
 */
export const addMissingPhotos = async (people: ReadonlyMap<string, PersonInfo>): Promise<void> => {
    const missing = [...people].filter(([, person]) => !person.photoUrl).map(([id]) => id);
    const leads = await fetchLeads(missing);
    for (const language of PHOTO_LANGUAGES) {
        const byTitle = leads.articles.get(language);
        if (byTitle) {
            // biome-ignore lint/performance/noAwaitInLoops: languages are tried in order of preference.
            await addLeadImages(people, language, byTitle);
        }
    }
    for (const [id, portrait] of leads.portraits) {
        const person = people.get(id);
        if (person && !person.photoUrl) {
            person.photoUrl = portrait;
        }
    }
    const found = missing.filter((id) => people.get(id)?.photoUrl).length;
    log.info(`Photos found for ${found} of ${missing.length} people Wikidata has none for`);
};

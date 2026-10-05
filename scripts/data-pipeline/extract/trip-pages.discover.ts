import { normalizeName, stripParenthetical } from "../lib/text";
import {
    listTitlesWithPrefix,
    searchTitles,
    WIKI_LANGUAGES,
    type WikiLanguage,
} from "../sources/wikipedia";
import { TRIP_PAGE_OVERRIDES } from "./trip-pages.overrides";

/**
 * Finds the Wikipedia trip-list pages of officials, e.g. "List of international prime
 * ministerial trips made by Narendra Modi", "List of state visits received by Elizabeth II",
 * "Anexo:Viajes internacionales del presidente José Mujica", "Liste des voyages officiels
 * effectués par Kim Jong-il", "Lista de viagens presidenciais de Santiago Peña" or
 * "이재명의 대통령 순방 목록". Every such page title is listed once per Wikipedia, then matched
 * to officials by the title of their article there, which scales to every country without a
 * search per person.
 */

/** Whether a page lists the person's own trips or the visits they received. */
export type TripPageDirection = "outgoing" | "received";

interface TitlePatterns {
    /** Namespace of the lists: Spanish Wikipedia keeps them under "Anexo:". */
    namespace: number;
    /** Trips the person made. "Made and received" pages also hold received visits, by heading. */
    outgoing: RegExp;
    /** Title prefixes (without namespace) listed from the Wikipedia. */
    prefixes: readonly string[];
    /** Visits the person hosted: the visitors are in the table rows. */
    received: RegExp | null;
    /** Searches finding lists whose titles start with the person's name (Korean). */
    searches?: readonly string[];
    /** Office words before the name ("del presidente José Mujica"). */
    titleWords: RegExp | null;
}

const PATTERNS: Readonly<Record<WikiLanguage, TitlePatterns>> = {
    ar: {
        namespace: 0,
        // "قائمة رحلات برهم صالح الخارجية"; lists named after an office are in the overrides.
        outgoing: /^قائمة رحلات (.+?) الخارجية$/u,
        prefixes: ["قائمة رحلات", "قائمة الرحلات", "قائمة الزيارات"],
        received: null,
        titleWords: null,
    },
    de: {
        namespace: 0,
        // "Liste der Auslandsreisen von Bundespräsident Joachim Gauck".
        outgoing:
            /^Liste der (?:Auslandsreisen|Staatsbesuche|Reisen)(?: [\p{L}-]+)*? (?:von|des|der) (.+?)(?: \([^)]*\))?$/iu,
        prefixes: ["Liste der Auslandsreisen", "Liste der Staatsbesuche"],
        received: null,
        titleWords:
            /^(?:bundespräsident(?:in)?|bundeskanzler(?:in)?|präsident(?:in)?|kanzler(?:in)?|könig(?:in)?|papst|ministerpräsident(?:in)?|außenminister(?:in)?)\s+/i,
    },
    en: {
        namespace: 0,
        // "international prime ministerial trips", "vice presidential trips", "Commonwealth
        // official trips", "international visits"… made by someone.
        outgoing:
            /^List of (?:[\w-]+ )*?(?:trips|visits) made (?:and received )?by (.+?)(?: as .+?)?(?: \([^)]*\))?$/i,
        prefixes: [
            "List of international",
            "List of official overseas trips",
            "List of presidential trips",
            "List of vice presidential trips",
            "List of vice-presidential trips",
            "List of Commonwealth official trips",
            "List of state visits",
        ],
        received: /^List of state visits received by (.+?)(?: \([^)]*\))?$/i,
        titleWords: null,
    },
    es: {
        namespace: 104,
        outgoing:
            /^Anexo:(?:Viajes internacionales|Visitas oficiales al exterior) (?:de la |del |de )(.+?)(?: \([^)]*\))?$/i,
        prefixes: ["Viajes internacionales", "Visitas oficiales al exterior"],
        received: null,
        titleWords:
            /^(?:presidente del gobierno|presidenta del gobierno|presidente|presidenta|primer ministro|primera ministra|canciller|rey|reina|emperador|emperatriz)\s+/i,
    },
    fa: {
        namespace: 0,
        // "فهرست سفرهای خارجی نیکول پاشینیان، نخست‌وزیر ارمنستان".
        outgoing:
            /^فهرست سفرهای (?:خارجی|بین\u200cالمللی)(?: (?:ریاست\u200cجمهوری|نخست\u200cوزیری))? (.+?)(?:، .+)?$/u,
        prefixes: ["فهرست سفرهای"],
        received: null,
        titleWords: null,
    },
    fr: {
        namespace: 0,
        outgoing:
            /^Liste des (?:voyages officiels effectués par |voyages présidentiels (?:à l'étranger )?(?:de |d')|visites d'État (?:effectuées par |du |de la |de l'))(.+?)(?: \([^)]*\))?$/i,
        prefixes: ["Liste des voyages", "Liste des visites d'État"],
        received: /^Liste des visites d'État reçues par (.+?)(?: \([^)]*\))?$/i,
        titleWords: /^(?:le |la )?(?:roi|reine|président|présidente|empereur|impératrice)\s+/i,
    },
    id: {
        namespace: 0,
        // "Daftar kunjungan kenegaraan Joko Widodo"; not "Daftar kunjungan kepausan ke …".
        outgoing:
            /^Daftar kunjungan (?:kenegaraan|kerja|resmi|luar negeri|internasional)(?: (?:presiden|perdana menteri|wakil presiden|raja))? (?!ke )(.+?)(?: \([^)]*\))?$/iu,
        prefixes: ["Daftar kunjungan"],
        received: null,
        titleWords: null,
    },
    ko: {
        namespace: 0,
        // "이재명의 대통령 순방 목록": the name comes first, so the lists are found by search.
        outgoing: /^(.+?)의 (?:\p{L}+ )*?순방 목록$/u,
        prefixes: [],
        received: null,
        searches: ['intitle:"순방 목록"'],
        titleWords: null,
    },
    pt: {
        namespace: 0,
        // "Lista de viagens presidenciais de Santiago Peña", "…primo-ministeriais de Liz Truss".
        outgoing:
            /^Lista de (?:viagens|visitas)(?: [\p{L}-]+)*? (?:de|do|da|dos|das) (.+?)(?: \([^)]*\))?$/iu,
        prefixes: ["Lista de viagens", "Lista de visitas"],
        received: null,
        titleWords:
            /^(?:presidente|presidenta|primeiro-ministro|primeira-ministra|rei|rainha|papa)\s+/i,
    },
};
/**
 * Domestic travel: explicit, or the yearly US "List of presidential trips made by Joe Biden
 * (2022)" pages, which are mostly domestic (the Office of the Historian covers the trips abroad).
 */
const DOMESTIC = /\bdomestic\b|^List of presidential trips made by .+ \(\d{4}/i;
/** "es:Anexo:…" in the overrides names a page on another Wikipedia. */
const LANGUAGE_PREFIX = /^([a-z]{2}):(.+)$/;

export interface TripPageCandidate {
    /** The person's article on each Wikipedia that has one. */
    articles: Partial<Record<WikiLanguage, string>>;
    /** Caller's key for the person (a Wikidata id). */
    key: string;
}

export interface TripPage {
    direction: TripPageDirection;
    key: string;
    language: WikiLanguage;
    title: string;
}

/**
 * Reads whom a trip-list page is about and which way the trips go.
 *
 * @param pageTitle - Page title.
 * @param language - Wikipedia the page is on.
 * @returns The normalised name and direction, or `null` for other pages (domestic trips,
 * single-country pages such as "…trips made by Donald Trump to China").
 */
export const classifyTripPage = (
    pageTitle: string,
    language: WikiLanguage = "en"
): { direction: TripPageDirection; subject: string } | null => {
    if (DOMESTIC.test(pageTitle)) {
        return null;
    }
    const patterns = PATTERNS[language];
    const subjectOf = (name: string): string =>
        normalizeName(patterns.titleWords ? name.replace(patterns.titleWords, "") : name);
    const received = patterns.received ? pageTitle.match(patterns.received)?.[1] : undefined;
    if (received) {
        return { direction: "received", subject: subjectOf(received) };
    }
    const outgoing = pageTitle.match(patterns.outgoing)?.[1];
    return outgoing ? { direction: "outgoing", subject: subjectOf(outgoing) } : null;
};

/**
 * Whether a page's subject is the person with this article. Spanish and French titles often
 * add the country to a monarch's name ("Albert II de Belgique" for the article "Albert II
 * (roi des Belges)"), so there a subject may continue with "de …".
 */
const isSubject = (subject: string, article: string, language: WikiLanguage): boolean => {
    const name = normalizeName(stripParenthetical(article));
    return subject === name || (language !== "en" && subject.startsWith(`${name} de `));
};

/** Pages named in the overrides, with the Wikipedia they are on. */
const overridePages = (titles: readonly string[]): [WikiLanguage, string][] =>
    titles.map((entry) => {
        const [, code, title] = entry.match(LANGUAGE_PREFIX) ?? [];
        const language = WIKI_LANGUAGES.find((known) => known === code);
        return language && title ? [language, title] : ["en", entry];
    });

/**
 * Finds the trip-list pages of the given people on every Wikipedia read.
 *
 * @param candidates - People to look for, with their article titles.
 * @returns Pages to parse, each tagged with its person's key and Wikipedia.
 */
export const discoverTripPages = async (
    candidates: readonly TripPageCandidate[]
): Promise<TripPage[]> => {
    const listed: {
        direction: TripPageDirection;
        language: WikiLanguage;
        subject: string;
        title: string;
    }[] = [];
    for (const language of WIKI_LANGUAGES) {
        const { namespace, prefixes, searches = [] } = PATTERNS[language];
        const titles = new Set<string>();
        for (const prefix of prefixes) {
            for (const title of await listTitlesWithPrefix(prefix, language, namespace)) {
                titles.add(title);
            }
        }
        for (const query of searches) {
            for (const title of await searchTitles(query, language, Number.POSITIVE_INFINITY)) {
                titles.add(title);
            }
        }
        for (const title of titles) {
            const page = classifyTripPage(title, language);
            if (page) {
                listed.push({ ...page, language, title });
            }
        }
    }

    return candidates.flatMap(({ articles, key }) => {
        // Exact name: "…trips made by Donald Trump to China" is about one country, not the person.
        const found = listed.filter(({ language, subject }) => {
            const article = articles[language];
            return article !== undefined && isSubject(subject, article, language);
        });
        const override = TRIP_PAGE_OVERRIDES[key];
        const added = overridePages(override?.add ?? []).map(([language, title]) => ({
            direction: classifyTripPage(title, language)?.direction ?? "outgoing",
            language,
            title,
        }));
        const pages = new Map<string, TripPage>();
        for (const { direction, language, title } of [...found, ...added]) {
            if (!override?.exclude?.includes(title)) {
                pages.set(`${language}:${title}`, { direction, key, language, title });
            }
        }
        return [...pages.values()];
    });
};

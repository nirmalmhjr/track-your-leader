/**
 * Manual corrections to trip-page discovery, keyed by the official's Wikidata id.
 *
 * Discovery lists trip-list pages on the English, Spanish and French Wikipedias ("List of
 * international … trips made by <name>", "Anexo:Viajes internacionales de <name>", …). If it
 * misses a page (unusual title) or picks a wrong one, fix it here; `data/warehouse/report.json`
 * lists the pages found for each official after every run. Pages on other Wikipedias start
 * with their language code, e.g. "fr:Liste des visites d'État du roi Albert II de Belgique".
 *
 * @example
 * Q1058: { add: ["List of international prime ministerial trips made by Narendra Modi"] },
 */
export const TRIP_PAGE_OVERRIDES: Readonly<
    Record<string, { add?: readonly string[]; exclude?: readonly string[] }>
> = {};

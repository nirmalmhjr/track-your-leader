/**
 * Manual corrections to trip-page discovery, keyed by the official's Wikidata id.
 *
 * Discovery searches Wikipedia for "List of international … trips made by <name>". If it
 * misses a page (unusual title) or picks a wrong one, fix it here; `state/report.json`
 * lists the pages found for each official after every run.
 *
 * @example
 * Q1058: { add: ["List of international prime ministerial trips made by Narendra Modi"] },
 */
export const TRIP_PAGE_OVERRIDES: Readonly<
    Record<string, { add?: readonly string[]; exclude?: readonly string[] }>
> = {};

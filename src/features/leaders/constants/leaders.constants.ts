/** Tabs of a country page: who holds office now, who held it before, and everyone else. */
export const COUNTRY_TABS = ["in-office", "former", "people"] as const;

/** Query-string key holding the open tab, e.g. `/leaders/usa?view=former`. */
export const COUNTRY_TAB_PARAM = "view";

/** Anchor of the tabs, so a link can switch tab and scroll to it. */
export const COUNTRY_TABS_ANCHOR = "officials";

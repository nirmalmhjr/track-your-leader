/** Tabs of a country page: who holds office now, who held it before, and everyone else. */
export const COUNTRY_TABS = ["in-office", "former", "people"] as const;

/** Query-string key holding the open tab, e.g. `/leaders/usa?view=former`. */
export const COUNTRY_TAB_PARAM = "view";

/** Anchor of the tabs, so a link can switch tab and scroll to it. */
export const COUNTRY_TABS_ANCHOR = "officials";

/**
 * Chip and bar colours for parties, given out largest party first. They are the theme's chart
 * colours, not party brand colours, so no party looks endorsed.
 */
export const PARTY_COLOR_CLASSES = [
    "bg-chart-1",
    "bg-chart-2",
    "bg-chart-3",
    "bg-chart-4",
    "bg-chart-5",
] as const;

/** Parties beyond the palette share one colour; the legend still names each of them. */
export const OTHER_PARTY_COLOR_CLASS = "bg-muted-foreground/70";

/** Officials whose party isn't recorded. */
export const UNKNOWN_PARTY_COLOR_CLASS = "bg-muted-foreground/25";

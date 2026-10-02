/** ISO 3166-1 alpha-3 country code, e.g. `NPL`. */
export type CountryCode = string;

/** Longitude/latitude pair in degrees, in GeoJSON order. */
export type Coordinates = readonly [longitude: number, latitude: number];

export type WorldRegion = "Africa" | "Americas" | "Antarctic" | "Asia" | "Europe" | "Oceania";

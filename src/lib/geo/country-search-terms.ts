import type { CountryCode } from "@/types/geo.types";

import { getCountryReference } from "./country-reference";

/**
 * Everyday abbreviations and former or alternative names people type instead of the reference
 * name ("UK", "UAE", "Burma"). ISO codes are added separately for every country.
 */
const COUNTRY_ALIASES: Readonly<Partial<Record<CountryCode, readonly string[]>>> = {
    ARE: ["UAE", "Emirates"],
    BIH: ["Bosnia"],
    CAF: ["CAR"],
    CIV: ["Côte d'Ivoire"],
    COD: ["DRC", "Democratic Republic of the Congo", "Congo-Kinshasa"],
    COG: ["Congo-Brazzaville"],
    CPV: ["Cabo Verde"],
    CZE: ["Czech Republic"],
    FSM: ["Federated States of Micronesia"],
    GBR: ["UK", "Britain", "Great Britain"],
    KOR: ["Korea", "ROK", "Republic of Korea"],
    MKD: ["Macedonia"],
    MMR: ["Burma"],
    NLD: ["Holland"],
    NZL: ["NZ"],
    PRK: ["DPRK"],
    PSE: ["State of Palestine"],
    RUS: ["Russian Federation"],
    SAU: ["KSA"],
    SWZ: ["Swaziland"],
    TLS: ["East Timor"],
    TUR: ["Turkey"],
    USA: ["US", "America", "United States of America"],
    VAT: ["Holy See"],
    ZAF: ["RSA"],
};

/**
 * Text a country can be found by besides its displayed name: its English reference name, ISO
 * alpha-3 and alpha-2 codes, and common abbreviations.
 *
 * @param code - ISO alpha-3 country code.
 * @returns Search terms for the country.
 */
export const getCountrySearchTerms = (code: CountryCode): string[] => {
    const reference = getCountryReference(code);
    return [
        ...(reference ? [reference.name, reference.alpha2] : []),
        code,
        ...(COUNTRY_ALIASES[code] ?? []),
    ];
};

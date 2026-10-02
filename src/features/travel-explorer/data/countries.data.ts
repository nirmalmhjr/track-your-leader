import type { RoleCategory } from "@/features/travel-explorer/types/travel.types";
import type { CountryCode } from "@/types/geo.types";

import type { SampleCityKey } from "./cities.data";

export interface SampleCountrySeed {
    capital: SampleCityKey;
    code: CountryCode;
    governmentSystem: string;
    name: string;
    /** The office that normally represents the country at leaders' summits. */
    summitLead: Extract<RoleCategory, "head_of_state" | "head_of_government">;
}

export const SAMPLE_COUNTRY_SEEDS: readonly SampleCountrySeed[] = [
    {
        capital: "kathmandu",
        code: "NPL",
        governmentSystem: "Federal parliamentary republic",
        name: "Nepal",
        summitLead: "head_of_government",
    },
    {
        capital: "new-delhi",
        code: "IND",
        governmentSystem: "Federal parliamentary republic",
        name: "India",
        summitLead: "head_of_government",
    },
    {
        capital: "dhaka",
        code: "BGD",
        governmentSystem: "Unitary parliamentary republic",
        name: "Bangladesh",
        summitLead: "head_of_government",
    },
    {
        capital: "colombo",
        code: "LKA",
        governmentSystem: "Unitary semi-presidential republic",
        name: "Sri Lanka",
        summitLead: "head_of_state",
    },
    {
        capital: "beijing",
        code: "CHN",
        governmentSystem: "Unitary one-party socialist republic",
        name: "China",
        summitLead: "head_of_state",
    },
    {
        capital: "tokyo",
        code: "JPN",
        governmentSystem: "Unitary parliamentary constitutional monarchy",
        name: "Japan",
        summitLead: "head_of_government",
    },
    {
        capital: "seoul",
        code: "KOR",
        governmentSystem: "Unitary presidential republic",
        name: "South Korea",
        summitLead: "head_of_state",
    },
    {
        capital: "jakarta",
        code: "IDN",
        governmentSystem: "Unitary presidential republic",
        name: "Indonesia",
        summitLead: "head_of_state",
    },
    {
        capital: "ankara",
        code: "TUR",
        governmentSystem: "Unitary presidential republic",
        name: "Türkiye",
        summitLead: "head_of_state",
    },
    {
        capital: "london",
        code: "GBR",
        governmentSystem: "Unitary parliamentary constitutional monarchy",
        name: "United Kingdom",
        summitLead: "head_of_government",
    },
    {
        capital: "paris",
        code: "FRA",
        governmentSystem: "Unitary semi-presidential republic",
        name: "France",
        summitLead: "head_of_state",
    },
    {
        capital: "berlin",
        code: "DEU",
        governmentSystem: "Federal parliamentary republic",
        name: "Germany",
        summitLead: "head_of_government",
    },
    {
        capital: "rome",
        code: "ITA",
        governmentSystem: "Unitary parliamentary republic",
        name: "Italy",
        summitLead: "head_of_government",
    },
    {
        capital: "kyiv",
        code: "UKR",
        governmentSystem: "Unitary semi-presidential republic",
        name: "Ukraine",
        summitLead: "head_of_state",
    },
    {
        capital: "washington",
        code: "USA",
        governmentSystem: "Federal presidential republic",
        name: "United States",
        summitLead: "head_of_state",
    },
    {
        capital: "ottawa",
        code: "CAN",
        governmentSystem: "Federal parliamentary constitutional monarchy",
        name: "Canada",
        summitLead: "head_of_government",
    },
    {
        capital: "mexico-city",
        code: "MEX",
        governmentSystem: "Federal presidential republic",
        name: "Mexico",
        summitLead: "head_of_state",
    },
    {
        capital: "brasilia",
        code: "BRA",
        governmentSystem: "Federal presidential republic",
        name: "Brazil",
        summitLead: "head_of_state",
    },
    {
        capital: "pretoria",
        code: "ZAF",
        governmentSystem: "Unitary parliamentary republic with an executive presidency",
        name: "South Africa",
        summitLead: "head_of_state",
    },
    {
        capital: "abuja",
        code: "NGA",
        governmentSystem: "Federal presidential republic",
        name: "Nigeria",
        summitLead: "head_of_state",
    },
    {
        capital: "nairobi",
        code: "KEN",
        governmentSystem: "Unitary presidential republic",
        name: "Kenya",
        summitLead: "head_of_state",
    },
    {
        capital: "cairo",
        code: "EGY",
        governmentSystem: "Unitary semi-presidential republic",
        name: "Egypt",
        summitLead: "head_of_state",
    },
    {
        capital: "canberra",
        code: "AUS",
        governmentSystem: "Federal parliamentary constitutional monarchy",
        name: "Australia",
        summitLead: "head_of_government",
    },
    {
        capital: "wellington",
        code: "NZL",
        governmentSystem: "Unitary parliamentary constitutional monarchy",
        name: "New Zealand",
        summitLead: "head_of_government",
    },
];

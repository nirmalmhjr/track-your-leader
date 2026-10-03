import type { Place, TrackedCountry } from "@/features/travel-explorer/types/travel.types";
import { getCountryRegion } from "@/lib/geo/country-reference";
import type { CountryCode } from "@/types/geo.types";

const capital = (
    city: string,
    countryCode: CountryCode,
    longitude: number,
    latitude: number
): Place => ({
    city,
    coordinates: [longitude, latitude],
    countryCode,
    region: getCountryRegion(countryCode),
});

const country = (
    code: CountryCode,
    name: string,
    governmentSystem: string,
    city: string,
    longitude: number,
    latitude: number
): TrackedCountry => ({
    capital: capital(city, code, longitude, latitude),
    code,
    governmentSystem,
    name,
});

/**
 * Countries whose officials the explorer follows. Trips start from the capital listed here.
 * The data pipeline (`scripts/data-pipeline`) reads this list too, so adding a country here
 * and to the pipeline's source config is all it takes to track it.
 */
export const TRACKED_COUNTRIES: readonly TrackedCountry[] = [
    country("NPL", "Nepal", "Federal parliamentary republic", "Kathmandu", 85.324, 27.7172),
    country("IND", "India", "Federal parliamentary republic", "New Delhi", 77.209, 28.6139),
    country("BGD", "Bangladesh", "Unitary parliamentary republic", "Dhaka", 90.4125, 23.8103),
    country("LKA", "Sri Lanka", "Unitary semi-presidential republic", "Colombo", 79.8612, 6.9271),
    country("CHN", "China", "Unitary one-party socialist republic", "Beijing", 116.4074, 39.9042),
    country(
        "JPN",
        "Japan",
        "Unitary parliamentary constitutional monarchy",
        "Tokyo",
        139.6917,
        35.6895
    ),
    country("KOR", "South Korea", "Unitary presidential republic", "Seoul", 126.978, 37.5665),
    country("IDN", "Indonesia", "Unitary presidential republic", "Jakarta", 106.8456, -6.2088),
    country("TUR", "Türkiye", "Unitary presidential republic", "Ankara", 32.8597, 39.9334),
    country(
        "GBR",
        "United Kingdom",
        "Unitary parliamentary constitutional monarchy",
        "London",
        -0.1276,
        51.5072
    ),
    country("FRA", "France", "Unitary semi-presidential republic", "Paris", 2.3522, 48.8566),
    country("DEU", "Germany", "Federal parliamentary republic", "Berlin", 13.405, 52.52),
    country("ITA", "Italy", "Unitary parliamentary republic", "Rome", 12.4964, 41.9028),
    country("UKR", "Ukraine", "Unitary semi-presidential republic", "Kyiv", 30.5234, 50.4501),
    country(
        "USA",
        "United States",
        "Federal presidential republic",
        "Washington",
        -77.0369,
        38.9072
    ),
    country(
        "CAN",
        "Canada",
        "Federal parliamentary constitutional monarchy",
        "Ottawa",
        -75.6972,
        45.4215
    ),
    country("MEX", "Mexico", "Federal presidential republic", "Mexico City", -99.1332, 19.4326),
    country("BRA", "Brazil", "Federal presidential republic", "Brasília", -47.8825, -15.7942),
    country(
        "ZAF",
        "South Africa",
        "Unitary parliamentary republic with an executive presidency",
        "Pretoria",
        28.2293,
        -25.7479
    ),
    country("NGA", "Nigeria", "Federal presidential republic", "Abuja", 7.3986, 9.0765),
    country("KEN", "Kenya", "Unitary presidential republic", "Nairobi", 36.8219, -1.2921),
    country("EGY", "Egypt", "Unitary semi-presidential republic", "Cairo", 31.2357, 30.0444),
    country(
        "AUS",
        "Australia",
        "Federal parliamentary constitutional monarchy",
        "Canberra",
        149.13,
        -35.2809
    ),
    country(
        "NZL",
        "New Zealand",
        "Unitary parliamentary constitutional monarchy",
        "Wellington",
        174.7762,
        -41.2865
    ),
];

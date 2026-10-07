import assert from "node:assert/strict";
import { test } from "node:test";

import type { CountryCode } from "@/types/geo.types";
import type { Place } from "@/types/travel.types";

import { claimsFromMeaVisit } from "../extract/claims/india-mea.claims";
import type { PlaceIndex } from "../extract/places.resolve";
import { type MeaDirection, parseMeaVisitList } from "../sources/india-mea";
import type { TripClaim } from "../types";

const capital = (countryCode: CountryCode, city: string): Place => ({
    city,
    coordinates: [0, 0],
    countryCode,
    region: "Asia",
});
const places: PlaceIndex = {
    capitals: new Map([
        ["BTN", capital("BTN", "Thimphu")],
        ["IND", capital("IND", "New Delhi")],
        ["NGA", capital("NGA", "Abuja")],
        ["RUS", capital("RUS", "Moscow")],
        ["TUR", capital("TUR", "Ankara")],
        ["USA", capital("USA", "Washington, D.C.")],
        ["ZAF", capital("ZAF", "Pretoria")],
    ]),
    codeByItem: new Map(),
    itemByCode: new Map(),
};

const read = (title: string, direction: MeaDirection = "incoming"): TripClaim[] | string => {
    const result = claimsFromMeaVisit(
        { direction, listed: "01 January, 2024", title, url: "https://www.mea.gov.in/x" },
        places
    );
    return Array.isArray(result) ? result : result.reason;
};
const summary = (title: string, direction?: MeaDirection) => {
    const result = read(title, direction);
    return typeof result === "string"
        ? result
        : result.map(({ datePrecision, destination, endDate, startDate, traveller }) => ({
              country: traveller.countryCode,
              dates: `${startDate}..${endDate} ${datePrecision}`,
              name: traveller.name,
              role: traveller.categories[0],
              to: destination.countryCode,
          }));
};

test("visits are read from MEA's list fragment, zero-width characters removed", () => {
    const html = `<div class="highlightContent visitBox"><div class="visitWrap">
        <span class="visitDate">31 August, 2026</span>
        <h3><a href="/incoming-visit-info?1/1603/Visit">Visit of​ Prime Minister of Belgium to India (September 02 - 04, 2026)</a></h3>
        </div></div>`;
    assert.deepEqual(parseMeaVisitList(html, "incoming"), [
        {
            direction: "incoming",
            listed: "31 August, 2026",
            title: "Visit of Prime Minister of Belgium to India (September 02 - 04, 2026)",
            url: "https://www.mea.gov.in/incoming-visit-info?1/1603/Visit",
        },
    ]);
});

test("a monarch's visit to India is read from the office and the country", () => {
    assert.deepEqual(
        summary("Official visit of His Majesty The King of Bhutan to India (December 05-06, 2024)"),
        [
            {
                country: "BTN",
                dates: "2024-12-05..2024-12-06 day",
                name: null,
                role: "head_of_state",
                to: "IND",
            },
        ]
    );
    assert.deepEqual(
        summary("Visit of the King and Queen of Bhutan to India (October 31 - 03 November, 2017)"),
        [
            {
                country: "BTN",
                dates: "2017-10-31..2017-11-03 day",
                name: null,
                role: "head_of_state",
                to: "IND",
            },
        ]
    );
});

test("names are kept when the headline gives one, with honorifics taken off", () => {
    const [mexico] = read(
        "State visit of H.E. Mr. Felipe Calderon Hinojosa, President of Mexico to India, 9-12 September, 2007"
    ) as TripClaim[];
    assert.equal(mexico?.traveller.name, "Felipe Calderon Hinojosa");
    assert.equal(mexico?.startDate, "2007-09-09");
    const [bhutan] = read(
        "State visit of the King of Bhutan H.M. Jigme Khesar Namgyel Wangchuck (January 23-30, 2013)"
    ) as TripClaim[];
    assert.equal(bhutan?.traveller.name, "Jigme Khesar Namgyel Wangchuck");
});

test("countries named by adjective or full name, and foreign ministers by any title", () => {
    const role = (title: string) => {
        const [claim] = read(title) as TripClaim[];
        return `${claim?.traveller.countryCode} ${claim?.traveller.portfolio ?? claim?.traveller.categories[0]}`;
    };
    assert.equal(
        role("Visit of Australian Foreign Minister to India (15-16 January, 2020)"),
        "AUS foreign_affairs"
    );
    assert.equal(
        role(
            "Visit of H.E. Marco Rubio, United States Secretary of State to India (23-26 May, 2026)"
        ),
        "USA foreign_affairs"
    );
    assert.equal(
        role("Visit of Foreign Minister of the Islamic Republic of Iran (May 28, 2018)"),
        "IRN foreign_affairs"
    );
    assert.equal(
        role("State Visit of PM of Italy to India (March 02-03, 2023)"),
        "ITA head_of_government"
    );
});

test("visits abroad by India's leaders: several countries are dated to the month only", () => {
    assert.deepEqual(
        summary("Visit of External Affairs Minister to Moscow (August 27-28, 2019)", "outgoing"),
        [
            {
                country: "IND",
                dates: "2019-08-27..2019-08-28 day",
                name: null,
                role: "minister",
                to: "RUS",
            },
        ]
    );
    const claims = read(
        "Prime Ministers Visit to Turkey & New York (September 16-28, 2003)",
        "outgoing"
    );
    assert.deepEqual(
        typeof claims === "string"
            ? claims
            : claims.map(
                  (claim) =>
                      `${claim.destination.countryCode} ${claim.startDate}..${claim.endDate} ${claim.datePrecision}`
              ),
        ["TUR 2003-09-01..2003-09-30 month", "USA 2003-09-01..2003-09-30 month"]
    );
});

test("deputies, envoys of organisations and undated visits are left out", () => {
    assert.equal(
        read(
            "Visit of H.E. Dr. Mehdi Safari, Deputy Minister of Foreign Affairs of the Islamic Republic of Iran to India (August 29-30, 2006)"
        ),
        "office not recognised"
    );
    assert.equal(
        read("Official visit of President of European Commission to India (February 27-28, 2025)"),
        "visiting country not found"
    );
    assert.equal(read("Visit of Prime Minister of Malaysia"), "no dates in headline");
});

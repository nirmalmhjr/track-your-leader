import type {
    IsoDate,
    Official,
    Portfolio,
    Position,
    RoleCategory,
} from "@/features/travel-explorer/types/travel.types";
import type { CountryCode } from "@/types/geo.types";

interface PositionSeed {
    categories: readonly RoleCategory[];
    from: IsoDate;
    ministry?: string;
    portfolio?: Portfolio;
    title: string;
    to?: IsoDate;
}

interface OfficialSeed {
    country: CountryCode;
    id: string;
    name: string;
    party?: string;
    positions: readonly PositionSeed[];
    summary: string;
}

const toPosition = (officialId: string, seed: PositionSeed, index: number): Position => ({
    categories: seed.categories,
    endDate: seed.to ?? null,
    id: `${officialId}-p${index + 1}`,
    ministry: seed.ministry ?? null,
    portfolio: seed.portfolio ?? null,
    startDate: seed.from,
    title: seed.title,
});

const official = (seed: OfficialSeed): Official => ({
    countryCode: seed.country,
    fullName: seed.name,
    id: seed.id,
    party: seed.party ?? null,
    photoUrl: null,
    positions: [...seed.positions]
        .sort((a, b) => b.from.localeCompare(a.from))
        .map((position, index) => toPosition(seed.id, position, index)),
    sources: [],
    summary: seed.summary,
    wikidataId: null,
});

const HOS = ["head_of_state"] as const;
const HOG = ["head_of_government"] as const;
const HOS_HOG = ["head_of_state", "head_of_government"] as const;
const DEPUTY = ["deputy_leader"] as const;
const MINISTER = ["minister"] as const;
const SENIOR = ["senior_official"] as const;

/**
 * Sample officials. People are fictional; offices, ministries and government structures
 * mirror each country's real system so the filters behave as they would with live data.
 */
export const SAMPLE_OFFICIALS: readonly Official[] = [
    // Nepal
    official({
        country: "NPL",
        id: "npl-president",
        name: "Ram Prasad Gautam",
        positions: [
            { categories: HOS, from: "2023-03-13", title: "President" },
            {
                categories: MINISTER,
                from: "2016-08-04",
                ministry: "Ministry of Home Affairs",
                portfolio: "home_affairs",
                title: "Minister of Home Affairs",
                to: "2017-05-31",
            },
        ],
        summary:
            "Ceremonial head of state and supreme commander of the army; travels abroad mainly on state visits.",
    }),
    official({
        country: "NPL",
        id: "npl-pm",
        name: "Balendra Shah",
        party: "Rastriya Swatantra Party",
        positions: [
            { categories: HOG, from: "2025-09-12", title: "Prime Minister" },
            {
                categories: MINISTER,
                from: "2022-12-26",
                ministry: "Ministry of Energy, Water Resources and Irrigation",
                portfolio: "energy",
                title: "Minister of Energy, Water Resources and Irrigation",
                to: "2024-03-04",
            },
        ],
        summary:
            "Former energy minister who leads a coalition government focused on hydropower exports and regional connectivity.",
    }),
    official({
        country: "NPL",
        id: "npl-pm-2024",
        name: "Krishna Bahadur Thapa",
        party: "United Left Front",
        positions: [
            { categories: HOG, from: "2024-07-15", title: "Prime Minister", to: "2025-09-12" },
            { categories: HOG, from: "2018-02-15", title: "Prime Minister", to: "2021-07-13" },
        ],
        summary: "Two-term former prime minister whose second government ended in September 2025.",
    }),
    official({
        country: "NPL",
        id: "npl-fm",
        name: "Anjana Shrestha",
        party: "Nepal Democratic Alliance",
        positions: [
            {
                categories: MINISTER,
                from: "2025-09-20",
                ministry: "Ministry of Foreign Affairs",
                portfolio: "foreign_affairs",
                title: "Minister of Foreign Affairs",
            },
            {
                categories: MINISTER,
                from: "2023-03-31",
                ministry: "Ministry of Industry, Commerce and Supplies",
                portfolio: "trade",
                title: "Minister of Industry, Commerce and Supplies",
                to: "2024-07-15",
            },
        ],
        summary:
            "Economist and former commerce minister now steering Nepal's diplomacy with its two large neighbours.",
    }),
    official({
        country: "NPL",
        id: "npl-finance",
        name: "Milan Kumar Rai",
        party: "Nepal Democratic Alliance",
        positions: [
            {
                categories: MINISTER,
                from: "2025-09-20",
                ministry: "Ministry of Finance",
                portfolio: "finance",
                title: "Minister of Finance",
            },
        ],
        summary: "Former central bank deputy governor responsible for the federal budget.",
    }),
    official({
        country: "NPL",
        id: "npl-foreign-secretary",
        name: "Sarita Gurung",
        positions: [
            {
                categories: SENIOR,
                from: "2024-11-01",
                ministry: "Ministry of Foreign Affairs",
                portfolio: "foreign_affairs",
                title: "Foreign Secretary",
            },
            {
                categories: SENIOR,
                from: "2020-06-15",
                ministry: "Ministry of Foreign Affairs",
                portfolio: "foreign_affairs",
                title: "Ambassador to Japan",
                to: "2024-10-31",
            },
        ],
        summary: "Career diplomat and the most senior civil servant at the foreign ministry.",
    }),

    // India
    official({
        country: "IND",
        id: "ind-pm",
        name: "Arvind Mehra",
        party: "National Progress Party",
        positions: [{ categories: HOG, from: "2019-05-30", title: "Prime Minister" }],
        summary:
            "Third-term prime minister with an active summit calendar across the G20, BRICS and the Quad.",
    }),
    official({
        country: "IND",
        id: "ind-president",
        name: "Savitri Nair",
        positions: [{ categories: HOS, from: "2022-07-25", title: "President" }],
        summary: "Constitutional head of state who undertakes state visits on government advice.",
    }),
    official({
        country: "IND",
        id: "ind-eam",
        name: "Raghav Iyer",
        party: "National Progress Party",
        positions: [
            {
                categories: MINISTER,
                from: "2019-05-30",
                ministry: "Ministry of External Affairs",
                portfolio: "foreign_affairs",
                title: "Minister of External Affairs",
            },
            {
                categories: SENIOR,
                from: "2015-01-29",
                ministry: "Ministry of External Affairs",
                portfolio: "foreign_affairs",
                title: "Foreign Secretary",
                to: "2018-01-28",
            },
        ],
        summary: "Former foreign secretary turned minister; India's lead negotiator abroad.",
    }),
    official({
        country: "IND",
        id: "ind-finance",
        name: "Meera Kulkarni",
        party: "National Progress Party",
        positions: [
            {
                categories: MINISTER,
                from: "2019-05-31",
                ministry: "Ministry of Finance",
                portfolio: "finance",
                title: "Minister of Finance",
            },
        ],
        summary: "Finance minister representing India at the IMF, World Bank and G20 tracks.",
    }),
    official({
        country: "IND",
        id: "ind-commerce",
        name: "Vikram Sethi",
        party: "National Progress Party",
        positions: [
            {
                categories: MINISTER,
                from: "2019-05-31",
                ministry: "Ministry of Commerce and Industry",
                portfolio: "trade",
                title: "Minister of Commerce and Industry",
            },
        ],
        summary: "Leads India's free trade negotiations with the UK, EU and United States.",
    }),
    official({
        country: "IND",
        id: "ind-foreign-secretary",
        name: "Anil Deshpande",
        positions: [
            {
                categories: SENIOR,
                from: "2024-07-15",
                ministry: "Ministry of External Affairs",
                portfolio: "foreign_affairs",
                title: "Foreign Secretary",
            },
        ],
        summary: "Career diplomat who heads foreign office consultations with neighbouring states.",
    }),

    // Bangladesh
    official({
        country: "BGD",
        id: "bgd-pm",
        name: "Nasrin Haque",
        party: "Bangladesh People's Front",
        positions: [{ categories: HOG, from: "2026-02-17", title: "Prime Minister" }],
        summary: "Elected in February 2026, ending an eighteen-month interim administration.",
    }),
    official({
        country: "BGD",
        id: "bgd-chief-adviser",
        name: "Mahbub Rahman",
        positions: [
            {
                categories: HOG,
                from: "2024-08-08",
                title: "Chief Adviser of the Interim Government",
                to: "2026-02-17",
            },
        ],
        summary: "Economist who led the non-party interim government until the 2026 election.",
    }),
    official({
        country: "BGD",
        id: "bgd-fm",
        name: "Tanvir Chowdhury",
        positions: [
            {
                categories: MINISTER,
                from: "2026-02-17",
                ministry: "Ministry of Foreign Affairs",
                portfolio: "foreign_affairs",
                title: "Minister of Foreign Affairs",
            },
            {
                categories: MINISTER,
                from: "2024-08-08",
                ministry: "Ministry of Foreign Affairs",
                portfolio: "foreign_affairs",
                title: "Adviser for Foreign Affairs",
                to: "2026-02-17",
            },
        ],
        summary: "Retired ambassador who stayed on at the foreign ministry after the election.",
    }),

    // Sri Lanka
    official({
        country: "LKA",
        id: "lka-president",
        name: "Nimal Perera",
        party: "People's Renewal Front",
        positions: [{ categories: HOS_HOG, from: "2024-09-23", title: "President" }],
        summary:
            "Executive president elected on an anti-corruption and debt-restructuring platform.",
    }),
    official({
        country: "LKA",
        id: "lka-pm",
        name: "Dilini Jayasuriya",
        party: "People's Renewal Front",
        positions: [{ categories: DEPUTY, from: "2024-09-24", title: "Prime Minister" }],
        summary: "Academic and parliamentarian who leads government business in parliament.",
    }),
    official({
        country: "LKA",
        id: "lka-fm",
        name: "Ruwan Fernando",
        party: "People's Renewal Front",
        positions: [
            {
                categories: MINISTER,
                from: "2024-11-18",
                ministry: "Ministry of Foreign Affairs",
                portfolio: "foreign_affairs",
                title: "Minister of Foreign Affairs",
            },
        ],
        summary: "Oversees Sri Lanka's regional diplomacy within BIMSTEC and the Indian Ocean.",
    }),

    // China
    official({
        country: "CHN",
        id: "chn-president",
        name: "Zhao Mingyuan",
        party: "Communist Party of China",
        positions: [{ categories: HOS, from: "2013-03-14", title: "President" }],
        summary: "Head of state who leads China's delegations to BRICS, APEC and state visits.",
    }),
    official({
        country: "CHN",
        id: "chn-premier",
        name: "Liu Jianhua",
        party: "Communist Party of China",
        positions: [{ categories: HOG, from: "2023-03-11", title: "Premier of the State Council" }],
        summary:
            "Heads the State Council and represents China at the G20 and ASEAN-related summits.",
    }),
    official({
        country: "CHN",
        id: "chn-fm",
        name: "Chen Weiguo",
        party: "Communist Party of China",
        positions: [
            {
                categories: MINISTER,
                from: "2023-07-25",
                ministry: "Ministry of Foreign Affairs",
                portfolio: "foreign_affairs",
                title: "Minister of Foreign Affairs",
            },
        ],
        summary: "Veteran diplomat responsible for boundary talks and China's Africa outreach.",
    }),
    official({
        country: "CHN",
        id: "chn-commerce",
        name: "Huang Lihua",
        party: "Communist Party of China",
        positions: [
            {
                categories: DEPUTY,
                from: "2023-03-12",
                portfolio: "trade",
                title: "Vice Premier of the State Council",
            },
        ],
        summary: "Vice premier in charge of economic policy and China's trade talks with the US.",
    }),

    // Japan
    official({
        country: "JPN",
        id: "jpn-pm",
        name: "Haruka Takeda",
        party: "Liberal Unity Party",
        positions: [
            { categories: HOG, from: "2025-10-21", title: "Prime Minister" },
            {
                categories: MINISTER,
                from: "2022-08-10",
                title: "Minister of State for Economic Security",
                to: "2023-09-13",
            },
        ],
        summary: "Took office in October 2025 after leading the party's economic security agenda.",
    }),
    official({
        country: "JPN",
        id: "jpn-pm-2024",
        name: "Kenji Morita",
        party: "Liberal Unity Party",
        positions: [
            { categories: HOG, from: "2024-10-01", title: "Prime Minister", to: "2025-10-21" },
        ],
        summary: "Served one year as prime minister before stepping down as party leader.",
    }),
    official({
        country: "JPN",
        id: "jpn-fm",
        name: "Daisuke Ono",
        party: "Liberal Unity Party",
        positions: [
            {
                categories: MINISTER,
                from: "2025-10-21",
                ministry: "Ministry of Foreign Affairs",
                portfolio: "foreign_affairs",
                title: "Minister for Foreign Affairs",
            },
            {
                categories: MINISTER,
                from: "2023-09-13",
                ministry: "Ministry of Defense",
                portfolio: "defence",
                title: "Minister of Defense",
                to: "2024-10-01",
            },
        ],
        summary:
            "Former defence minister focused on alliance management and Indo-Pacific security.",
    }),
    official({
        country: "JPN",
        id: "jpn-fm-2024",
        name: "Satoshi Imai",
        party: "Liberal Unity Party",
        positions: [
            {
                categories: MINISTER,
                from: "2024-10-01",
                ministry: "Ministry of Foreign Affairs",
                portfolio: "foreign_affairs",
                title: "Minister for Foreign Affairs",
                to: "2025-10-21",
            },
        ],
        summary: "Foreign minister in the previous cabinet; now a backbench member of the Diet.",
    }),
    official({
        country: "JPN",
        id: "jpn-finance",
        name: "Yuko Hayashi",
        party: "Liberal Unity Party",
        positions: [
            {
                categories: MINISTER,
                from: "2025-10-21",
                ministry: "Ministry of Finance",
                portfolio: "finance",
                title: "Minister of Finance",
            },
        ],
        summary: "First woman to lead Japan's finance ministry.",
    }),

    // South Korea
    official({
        country: "KOR",
        id: "kor-president",
        name: "Park Jae-won",
        party: "Democratic Alliance of Korea",
        positions: [{ categories: HOS_HOG, from: "2025-06-04", title: "President" }],
        summary:
            "Elected in a snap election in June 2025; pursues pragmatic diplomacy with neighbours.",
    }),
    official({
        country: "KOR",
        id: "kor-pm",
        name: "Kim Do-hyun",
        party: "Democratic Alliance of Korea",
        positions: [{ categories: DEPUTY, from: "2025-07-03", title: "Prime Minister" }],
        summary: "Principal deputy to the president, who is both head of state and government.",
    }),
    official({
        country: "KOR",
        id: "kor-fm",
        name: "Yoon Seo-yeon",
        positions: [
            {
                categories: MINISTER,
                from: "2025-07-21",
                ministry: "Ministry of Foreign Affairs",
                portfolio: "foreign_affairs",
                title: "Minister of Foreign Affairs",
            },
        ],
        summary: "Career diplomat and former ambassador to the United Nations.",
    }),

    // Indonesia
    official({
        country: "IDN",
        id: "idn-president",
        name: "Bima Santoso",
        party: "Indonesian Unity Party",
        positions: [
            { categories: HOS_HOG, from: "2024-10-20", title: "President" },
            {
                categories: MINISTER,
                from: "2019-10-23",
                ministry: "Ministry of Defence",
                portfolio: "defence",
                title: "Minister of Defence",
                to: "2024-10-20",
            },
        ],
        summary:
            "Former defence minister with an extensive overseas travel record since taking office.",
    }),
    official({
        country: "IDN",
        id: "idn-fm",
        name: "Ratna Wulandari",
        positions: [
            {
                categories: MINISTER,
                from: "2024-10-21",
                ministry: "Ministry of Foreign Affairs",
                portfolio: "foreign_affairs",
                title: "Minister of Foreign Affairs",
            },
        ],
        summary: "Coordinates Indonesia's ASEAN and BRICS engagement.",
    }),
    official({
        country: "IDN",
        id: "idn-finance",
        name: "Hendra Gunawan",
        positions: [
            {
                categories: MINISTER,
                from: "2025-09-08",
                ministry: "Ministry of Finance",
                portfolio: "finance",
                title: "Minister of Finance",
            },
        ],
        summary: "Economist appointed in a September 2025 cabinet reshuffle.",
    }),

    // Türkiye
    official({
        country: "TUR",
        id: "tur-president",
        name: "Mehmet Aydın",
        party: "Justice and Renewal Party",
        positions: [
            { categories: HOS_HOG, from: "2018-07-09", title: "President" },
            { categories: HOG, from: "2014-08-28", title: "Prime Minister", to: "2018-07-09" },
        ],
        summary:
            "Executive president since the 2018 constitutional change; previously prime minister.",
    }),
    official({
        country: "TUR",
        id: "tur-vp",
        name: "Elif Demir",
        party: "Justice and Renewal Party",
        positions: [{ categories: DEPUTY, from: "2023-06-03", title: "Vice President" }],
        summary: "Coordinates economic policy and represents the presidency at regional forums.",
    }),
    official({
        country: "TUR",
        id: "tur-fm",
        name: "Can Yılmaz",
        positions: [
            {
                categories: MINISTER,
                from: "2023-06-03",
                ministry: "Ministry of Foreign Affairs",
                portfolio: "foreign_affairs",
                title: "Minister of Foreign Affairs",
            },
        ],
        summary: "Former intelligence chief now leading Türkiye's mediation diplomacy.",
    }),

    // United Kingdom
    official({
        country: "GBR",
        id: "gbr-pm",
        name: "Eleanor Whitfield",
        party: "Progressive Alliance",
        positions: [{ categories: HOG, from: "2024-07-05", title: "Prime Minister" }],
        summary:
            "Prime minister since July 2024 with a focus on trade deals and European security.",
    }),
    official({
        country: "GBR",
        id: "gbr-foreign-secretary",
        name: "Thomas Ashby",
        party: "Progressive Alliance",
        positions: [
            {
                categories: MINISTER,
                from: "2025-09-05",
                ministry: "Foreign, Commonwealth and Development Office",
                portfolio: "foreign_affairs",
                title: "Foreign Secretary",
            },
            {
                categories: MINISTER,
                from: "2024-07-05",
                ministry: "Ministry of Justice",
                portfolio: "home_affairs",
                title: "Secretary of State for Justice",
                to: "2025-09-05",
            },
        ],
        summary:
            "Moved from the justice ministry to the Foreign Office in the September 2025 reshuffle.",
    }),
    official({
        country: "GBR",
        id: "gbr-home-secretary",
        name: "Daniel Price",
        party: "Progressive Alliance",
        positions: [
            {
                categories: MINISTER,
                from: "2025-09-05",
                ministry: "Home Office",
                portfolio: "home_affairs",
                title: "Home Secretary",
            },
            {
                categories: MINISTER,
                from: "2024-07-05",
                ministry: "Foreign, Commonwealth and Development Office",
                portfolio: "foreign_affairs",
                title: "Foreign Secretary",
                to: "2025-09-05",
            },
        ],
        summary:
            "Foreign Secretary until September 2025, now responsible for borders and policing.",
    }),
    official({
        country: "GBR",
        id: "gbr-chancellor",
        name: "Rachel Moss",
        party: "Progressive Alliance",
        positions: [
            {
                categories: MINISTER,
                from: "2024-07-05",
                ministry: "HM Treasury",
                portfolio: "finance",
                title: "Chancellor of the Exchequer",
            },
        ],
        summary:
            "Leads the UK's economic dialogues and represents it at the IMF and G7 finance track.",
    }),

    // France
    official({
        country: "FRA",
        id: "fra-president",
        name: "Laurent Delacroix",
        party: "Renewal Movement",
        positions: [{ categories: HOS, from: "2017-05-14", title: "President" }],
        summary:
            "Second-term president who sets foreign and defence policy under the Fifth Republic.",
    }),
    official({
        country: "FRA",
        id: "fra-pm",
        name: "Camille Moreau",
        party: "Renewal Movement",
        positions: [
            { categories: HOG, from: "2025-09-09", title: "Prime Minister" },
            {
                categories: MINISTER,
                from: "2022-05-20",
                ministry: "Ministry of the Armed Forces",
                portfolio: "defence",
                title: "Minister of the Armed Forces",
                to: "2025-09-09",
            },
        ],
        summary: "Former armed forces minister appointed prime minister in September 2025.",
    }),
    official({
        country: "FRA",
        id: "fra-fm",
        name: "Julien Marchand",
        party: "Renewal Movement",
        positions: [
            {
                categories: MINISTER,
                from: "2024-09-21",
                ministry: "Ministry for Europe and Foreign Affairs",
                portfolio: "foreign_affairs",
                title: "Minister for Europe and Foreign Affairs",
            },
        ],
        summary: "Leads France's diplomacy on Ukraine and the Middle East.",
    }),

    // Germany
    official({
        country: "DEU",
        id: "deu-chancellor",
        name: "Friedrich Hartmann",
        party: "Christian Civic Union",
        positions: [{ categories: HOG, from: "2025-05-06", title: "Federal Chancellor" }],
        summary: "Chancellor since May 2025 leading a two-party coalition.",
    }),
    official({
        country: "DEU",
        id: "deu-chancellor-2021",
        name: "Markus Albrecht",
        party: "Social Democratic Union",
        positions: [
            {
                categories: HOG,
                from: "2021-12-08",
                title: "Federal Chancellor",
                to: "2025-05-06",
            },
        ],
        summary: "Former chancellor whose coalition collapsed in late 2024.",
    }),
    official({
        country: "DEU",
        id: "deu-fm",
        name: "Katrin Vogel",
        party: "Christian Civic Union",
        positions: [
            {
                categories: MINISTER,
                from: "2025-05-06",
                ministry: "Federal Foreign Office",
                portfolio: "foreign_affairs",
                title: "Federal Foreign Minister",
            },
        ],
        summary:
            "Foreign policy specialist and former chair of the Bundestag foreign affairs committee.",
    }),
    official({
        country: "DEU",
        id: "deu-finance",
        name: "Stefan Brandt",
        party: "Social Democratic Union",
        positions: [
            {
                categories: ["minister", "deputy_leader"],
                from: "2025-05-06",
                ministry: "Federal Ministry of Finance",
                portfolio: "finance",
                title: "Federal Minister of Finance and Vice-Chancellor",
            },
        ],
        summary:
            "Junior coalition partner's leader, combining the finance ministry with vice-chancellorship.",
    }),

    // Italy
    official({
        country: "ITA",
        id: "ita-pm",
        name: "Giulia Ferraro",
        party: "National Renewal",
        positions: [
            { categories: HOG, from: "2022-10-22", title: "President of the Council of Ministers" },
        ],
        summary: "Prime minister since 2022 and a regular at G7, NATO and EU summits.",
    }),
    official({
        country: "ITA",
        id: "ita-fm",
        name: "Marco Bellini",
        party: "Forward Italy Alliance",
        positions: [
            {
                categories: ["minister", "deputy_leader"],
                from: "2022-10-22",
                ministry: "Ministry of Foreign Affairs and International Cooperation",
                portfolio: "foreign_affairs",
                title: "Minister of Foreign Affairs and Deputy Prime Minister",
            },
        ],
        summary:
            "Coalition partner leader serving as both foreign minister and deputy prime minister.",
    }),
    official({
        country: "ITA",
        id: "ita-finance",
        name: "Paolo Ricci",
        party: "Northern League for Autonomy",
        positions: [
            {
                categories: MINISTER,
                from: "2022-10-22",
                ministry: "Ministry of Economy and Finance",
                portfolio: "finance",
                title: "Minister of Economy and Finance",
            },
        ],
        summary: "Responsible for Italy's budget and its representation at international lenders.",
    }),

    // Ukraine
    official({
        country: "UKR",
        id: "ukr-president",
        name: "Oleksandr Kovalenko",
        party: "Civic Ukraine",
        positions: [{ categories: HOS, from: "2019-05-20", title: "President" }],
        summary:
            "Wartime president whose travel centres on security guarantees and reconstruction.",
    }),
    official({
        country: "UKR",
        id: "ukr-pm",
        name: "Iryna Bondar",
        party: "Civic Ukraine",
        positions: [
            { categories: HOG, from: "2025-07-17", title: "Prime Minister" },
            {
                categories: ["deputy_leader", "minister"],
                from: "2021-11-04",
                ministry: "Ministry of Economy",
                portfolio: "trade",
                title: "First Deputy Prime Minister and Minister of Economy",
                to: "2025-07-17",
            },
        ],
        summary: "Former economy minister who negotiated Ukraine's minerals and trade agreements.",
    }),
    official({
        country: "UKR",
        id: "ukr-fm",
        name: "Taras Levchenko",
        positions: [
            {
                categories: MINISTER,
                from: "2024-09-05",
                ministry: "Ministry of Foreign Affairs",
                portfolio: "foreign_affairs",
                title: "Minister of Foreign Affairs",
            },
        ],
        summary: "Career diplomat and former deputy foreign minister for European integration.",
    }),

    // United States
    official({
        country: "USA",
        id: "usa-president",
        name: "Richard Calloway",
        party: "American Unity Party",
        positions: [{ categories: HOS_HOG, from: "2025-01-20", title: "President" }],
        summary: "Head of state and government since January 2025.",
    }),
    official({
        country: "USA",
        id: "usa-vp",
        name: "Jordan Pierce",
        party: "American Unity Party",
        positions: [{ categories: DEPUTY, from: "2025-01-20", title: "Vice President" }],
        summary: "Represents the administration at security and technology conferences abroad.",
    }),
    official({
        country: "USA",
        id: "usa-sos",
        name: "Victor Alvarez",
        party: "American Unity Party",
        positions: [
            {
                categories: MINISTER,
                from: "2025-01-21",
                ministry: "Department of State",
                portfolio: "foreign_affairs",
                title: "Secretary of State",
            },
        ],
        summary: "Cabinet secretary leading US diplomacy; a minister-level role despite the title.",
    }),
    official({
        country: "USA",
        id: "usa-treasury",
        name: "Margaret Ellison",
        party: "American Unity Party",
        positions: [
            {
                categories: MINISTER,
                from: "2025-01-28",
                ministry: "Department of the Treasury",
                portfolio: "finance",
                title: "Secretary of the Treasury",
            },
        ],
        summary: "Leads US economic talks with China and the G7 finance track.",
    }),
    official({
        country: "USA",
        id: "usa-trade",
        name: "Howard Lin",
        positions: [
            {
                categories: SENIOR,
                from: "2025-02-26",
                ministry: "Office of the United States Trade Representative",
                portfolio: "trade",
                title: "United States Trade Representative",
            },
        ],
        summary: "Cabinet-level trade negotiator holding the rank of ambassador.",
    }),

    // Canada
    official({
        country: "CAN",
        id: "can-pm",
        name: "Matthew Clarke",
        party: "Liberal Union",
        positions: [{ categories: HOG, from: "2025-03-14", title: "Prime Minister" }],
        summary: "Former central banker who became prime minister in March 2025.",
    }),
    official({
        country: "CAN",
        id: "can-pm-2015",
        name: "Julian Bertrand",
        party: "Liberal Union",
        positions: [
            { categories: HOG, from: "2015-11-04", title: "Prime Minister", to: "2025-03-14" },
        ],
        summary: "Prime minister for nearly a decade before resigning in early 2025.",
    }),
    official({
        country: "CAN",
        id: "can-fm",
        name: "Priya Sandhu",
        party: "Liberal Union",
        positions: [
            {
                categories: MINISTER,
                from: "2025-05-13",
                ministry: "Global Affairs Canada",
                portfolio: "foreign_affairs",
                title: "Minister of Foreign Affairs",
            },
        ],
        summary: "Leads Canada's effort to diversify partnerships in the Indo-Pacific.",
    }),
    official({
        country: "CAN",
        id: "can-finance",
        name: "Luc Gagnon",
        party: "Liberal Union",
        positions: [
            {
                categories: MINISTER,
                from: "2025-05-13",
                ministry: "Department of Finance",
                portfolio: "finance",
                title: "Minister of Finance",
            },
        ],
        summary: "Represents Canada at the IMF and G7 finance ministers' meetings.",
    }),

    // Mexico
    official({
        country: "MEX",
        id: "mex-president",
        name: "Ana Lucía Herrera",
        party: "Citizens' Transformation Party",
        positions: [{ categories: HOS_HOG, from: "2024-10-01", title: "President" }],
        summary: "Travels abroad sparingly and often delegates summits to her foreign secretary.",
    }),
    official({
        country: "MEX",
        id: "mex-fm",
        name: "Ricardo Montes",
        party: "Citizens' Transformation Party",
        positions: [
            {
                categories: MINISTER,
                from: "2024-10-01",
                ministry: "Secretariat of Foreign Affairs",
                portfolio: "foreign_affairs",
                title: "Secretary of Foreign Affairs",
            },
        ],
        summary: "Cabinet secretary representing Mexico at most multilateral meetings.",
    }),
    official({
        country: "MEX",
        id: "mex-finance",
        name: "Gabriela Fuentes",
        positions: [
            {
                categories: MINISTER,
                from: "2024-10-01",
                ministry: "Secretariat of Finance and Public Credit",
                portfolio: "finance",
                title: "Secretary of Finance and Public Credit",
            },
        ],
        summary: "Economist overseeing fiscal policy and relations with international lenders.",
    }),

    // Brazil
    official({
        country: "BRA",
        id: "bra-president",
        name: "Paulo Henrique Moura",
        party: "Workers' Union Party",
        positions: [{ categories: HOS_HOG, from: "2023-01-01", title: "President" }],
        summary: "Hosted BRICS and COP30 in 2025 and travels widely across the Global South.",
    }),
    official({
        country: "BRA",
        id: "bra-fm",
        name: "Helena Duarte",
        positions: [
            {
                categories: MINISTER,
                from: "2023-01-01",
                ministry: "Ministry of Foreign Affairs",
                portfolio: "foreign_affairs",
                title: "Minister of Foreign Affairs",
            },
        ],
        summary: "Career diplomat leading Brazil's G20 and BRICS negotiating teams.",
    }),
    official({
        country: "BRA",
        id: "bra-finance",
        name: "Rafael Teixeira",
        party: "Workers' Union Party",
        positions: [
            {
                categories: MINISTER,
                from: "2023-01-01",
                ministry: "Ministry of Finance",
                portfolio: "finance",
                title: "Minister of Finance",
            },
        ],
        summary: "Champion of a global minimum tax on the super-rich at the G20.",
    }),
    official({
        country: "BRA",
        id: "bra-environment",
        name: "Luana Ribeiro",
        party: "Sustainability Network",
        positions: [
            {
                categories: MINISTER,
                from: "2023-01-01",
                ministry: "Ministry of Environment and Climate Change",
                portfolio: "environment",
                title: "Minister of Environment and Climate Change",
            },
        ],
        summary: "Leads Brazil's climate diplomacy and Amazon protection programmes.",
    }),

    // South Africa
    official({
        country: "ZAF",
        id: "zaf-president",
        name: "Sipho Dlamini",
        party: "African Democratic Congress",
        positions: [
            { categories: HOS_HOG, from: "2018-02-15", title: "President" },
            {
                categories: DEPUTY,
                from: "2014-05-26",
                title: "Deputy President",
                to: "2018-02-15",
            },
        ],
        summary: "Hosted the 2025 G20 summit, the first held on African soil.",
    }),
    official({
        country: "ZAF",
        id: "zaf-dirco",
        name: "Nomvula Khumalo",
        party: "African Democratic Congress",
        positions: [
            {
                categories: MINISTER,
                from: "2024-07-03",
                ministry: "Department of International Relations and Cooperation",
                portfolio: "foreign_affairs",
                title: "Minister of International Relations and Cooperation",
            },
        ],
        summary: "Leads South Africa's foreign ministry, known locally as DIRCO.",
    }),
    official({
        country: "ZAF",
        id: "zaf-finance",
        name: "Pieter van Wyk",
        party: "Democratic Unity Party",
        positions: [
            {
                categories: MINISTER,
                from: "2023-03-31",
                ministry: "National Treasury",
                portfolio: "finance",
                title: "Minister of Finance",
            },
        ],
        summary: "Member of the governing coalition's junior partner responsible for the Treasury.",
    }),

    // Nigeria
    official({
        country: "NGA",
        id: "nga-president",
        name: "Adebayo Okonkwo",
        party: "Progressive People's Congress",
        positions: [{ categories: HOS_HOG, from: "2023-05-29", title: "President" }],
        summary: "Former state governor pursuing investment-focused economic diplomacy.",
    }),
    official({
        country: "NGA",
        id: "nga-fm",
        name: "Chidinma Eze",
        party: "Progressive People's Congress",
        positions: [
            {
                categories: MINISTER,
                from: "2023-08-21",
                ministry: "Ministry of Foreign Affairs",
                portfolio: "foreign_affairs",
                title: "Minister of Foreign Affairs",
            },
        ],
        summary: "Represents Nigeria at ECOWAS, the African Union and UN meetings.",
    }),
    official({
        country: "NGA",
        id: "nga-finance",
        name: "Ibrahim Musa",
        positions: [
            {
                categories: MINISTER,
                from: "2023-08-21",
                ministry: "Federal Ministry of Finance",
                portfolio: "finance",
                title: "Minister of Finance and Coordinating Minister of the Economy",
            },
        ],
        summary: "Former investment banker coordinating Nigeria's economic reforms.",
    }),

    // Kenya
    official({
        country: "KEN",
        id: "ken-president",
        name: "Samuel Kiprono",
        party: "Kenya Forward Alliance",
        positions: [
            { categories: HOS_HOG, from: "2022-09-13", title: "President" },
            { categories: DEPUTY, from: "2013-04-09", title: "Deputy President", to: "2022-09-13" },
        ],
        summary: "Frequent traveller championing climate finance and debt reform for Africa.",
    }),
    official({
        country: "KEN",
        id: "ken-deputy-president",
        name: "Grace Wanjiru",
        party: "Kenya Forward Alliance",
        positions: [{ categories: DEPUTY, from: "2024-11-01", title: "Deputy President" }],
        summary: "Appointed deputy president in November 2024.",
    }),
    official({
        country: "KEN",
        id: "ken-foreign",
        name: "Peter Otieno",
        party: "Orange Democratic Front",
        positions: [
            {
                categories: MINISTER,
                from: "2024-07-19",
                ministry: "Ministry of Foreign and Diaspora Affairs",
                portfolio: "foreign_affairs",
                title: "Prime Cabinet Secretary and Cabinet Secretary for Foreign and Diaspora Affairs",
            },
        ],
        summary: "Kenya's cabinet secretaries are ministers appointed from outside parliament.",
    }),
    official({
        country: "KEN",
        id: "ken-trade",
        name: "Rose Achieng",
        positions: [
            {
                categories: MINISTER,
                from: "2024-08-08",
                ministry: "Ministry of Investments, Trade and Industry",
                portfolio: "trade",
                title: "Cabinet Secretary for Investments, Trade and Industry",
            },
        ],
        summary: "Leads Kenya's negotiations at the WTO and on regional trade agreements.",
    }),

    // Egypt
    official({
        country: "EGY",
        id: "egy-president",
        name: "Ahmed Farouk",
        positions: [{ categories: HOS, from: "2014-06-08", title: "President" }],
        summary:
            "Head of state who directs foreign policy; often delegates summits to the prime minister.",
    }),
    official({
        country: "EGY",
        id: "egy-pm",
        name: "Hany Mansour",
        positions: [{ categories: HOG, from: "2018-06-07", title: "Prime Minister" }],
        summary: "Technocrat prime minister who represents Egypt at BRICS and economic forums.",
    }),
    official({
        country: "EGY",
        id: "egy-fm",
        name: "Yasmin Adel",
        positions: [
            {
                categories: MINISTER,
                from: "2024-07-03",
                ministry: "Ministry of Foreign Affairs",
                portfolio: "foreign_affairs",
                title: "Minister of Foreign Affairs",
            },
        ],
        summary: "Career diplomat central to regional ceasefire and mediation efforts.",
    }),

    // Australia
    official({
        country: "AUS",
        id: "aus-pm",
        name: "James Halloran",
        party: "Commonwealth Labour",
        positions: [{ categories: HOG, from: "2022-05-23", title: "Prime Minister" }],
        summary: "Second-term prime minister focused on the Indo-Pacific and Pacific Islands.",
    }),
    official({
        country: "AUS",
        id: "aus-fm",
        name: "Sophie Tran",
        party: "Commonwealth Labour",
        positions: [
            {
                categories: MINISTER,
                from: "2022-05-23",
                ministry: "Department of Foreign Affairs and Trade",
                portfolio: "foreign_affairs",
                title: "Minister for Foreign Affairs",
            },
        ],
        summary: "Leads Australia's diplomacy across ASEAN, the Quad and the Pacific.",
    }),
    official({
        country: "AUS",
        id: "aus-trade",
        name: "Liam O'Connor",
        party: "Commonwealth Labour",
        positions: [
            {
                categories: MINISTER,
                from: "2022-06-01",
                ministry: "Department of Foreign Affairs and Trade",
                portfolio: "trade",
                title: "Minister for Trade and Tourism",
            },
        ],
        summary: "Negotiates Australia's trade agreements and represents it at the WTO.",
    }),
    official({
        country: "AUS",
        id: "aus-climate",
        name: "Hannah Brooks",
        party: "Commonwealth Labour",
        positions: [
            {
                categories: MINISTER,
                from: "2022-06-01",
                ministry: "Department of Climate Change, Energy, the Environment and Water",
                portfolio: "environment",
                title: "Minister for Climate Change and Energy",
            },
        ],
        summary: "Australia's lead negotiator for the COP31 presidency arrangements.",
    }),

    // New Zealand
    official({
        country: "NZL",
        id: "nzl-pm",
        name: "Oliver Grant",
        party: "National Reform Party",
        positions: [{ categories: HOG, from: "2023-11-27", title: "Prime Minister" }],
        summary: "Former business executive prioritising trade missions to Asia.",
    }),
    official({
        country: "NZL",
        id: "nzl-fm",
        name: "Wiremu Parata",
        party: "First Nation Party",
        positions: [
            {
                categories: MINISTER,
                from: "2023-11-27",
                ministry: "Ministry of Foreign Affairs and Trade",
                portfolio: "foreign_affairs",
                title: "Minister of Foreign Affairs",
            },
            {
                categories: DEPUTY,
                from: "2023-11-27",
                title: "Deputy Prime Minister",
                to: "2025-05-31",
            },
        ],
        summary:
            "Veteran politician who handed the deputy prime ministership to a coalition partner in 2025.",
    }),
];

import type { IsoDate, TravelType } from "@/features/travel-explorer/types/travel.types";

import type { SampleCityKey } from "./cities.data";

export interface SampleVisitSeed {
    city: SampleCityKey;
    endDate: IsoDate;
    engagements?: readonly string[];
    eventName?: string;
    officialId: string;
    purpose: string;
    startDate: IsoDate;
    /** Overrides the date-derived status. */
    status?: "cancelled" | "planned";
    type: TravelType;
}

type VisitOptions = Pick<SampleVisitSeed, "engagements" | "eventName" | "status">;

const visit = (
    officialId: string,
    [startDate, endDate]: readonly [IsoDate, IsoDate],
    city: SampleCityKey,
    type: TravelType,
    purpose: string,
    options: VisitOptions = {}
): SampleVisitSeed => ({ city, endDate, officialId, purpose, startDate, type, ...options });

const US_CHINA_TALKS = "United States–China economic and trade talks";

export const SAMPLE_VISITS: readonly SampleVisitSeed[] = [
    // Nepal
    visit(
        "npl-pm-2024",
        ["2024-12-02", "2024-12-05"],
        "beijing",
        "official_visit",
        "Official visit to China focused on connectivity, trade and the Belt and Road cooperation framework",
        {
            engagements: [
                "Talks with the President of China",
                "Delegation-level talks with the Premier of the State Council",
                "Signing of a framework agreement on connectivity",
            ],
        }
    ),
    visit(
        "npl-pm-2024",
        ["2025-06-16", "2025-06-19"],
        "new-delhi",
        "official_visit",
        "Official visit to India on energy trade, cross-border connectivity and investment",
        {
            engagements: [
                "Talks with the Prime Minister of India",
                "Signing of a long-term power trade agreement",
                "Address to the India–Nepal business forum",
            ],
        }
    ),
    visit(
        "npl-pm-2024",
        ["2025-08-14", "2025-08-17"],
        "tokyo",
        "official_visit",
        "Official visit to Japan on development cooperation and labour mobility, called off amid domestic unrest",
        { status: "cancelled" }
    ),
    visit(
        "npl-pm",
        ["2025-12-15", "2025-12-17"],
        "new-delhi",
        "official_visit",
        "First official visit to India after assuming office",
        {
            engagements: [
                "Talks with the Prime Minister of India",
                "Call on the President of India",
                "Review of the bilateral power trade agreement",
            ],
        }
    ),
    visit(
        "npl-pm",
        ["2026-05-11", "2026-05-14"],
        "beijing",
        "official_visit",
        "Official visit to China on trade, transit and hydropower cooperation",
        {
            engagements: [
                "Talks with the President of China",
                "Delegation-level talks with the Premier of the State Council",
                "Agreements on transit trade and hydropower",
            ],
        }
    ),
    visit(
        "npl-pm",
        ["2026-10-27", "2026-10-29"],
        "dhaka",
        "official_visit",
        "Official visit to Bangladesh on energy trade and sub-regional connectivity",
        {
            engagements: [
                "Talks with the Prime Minister of Bangladesh",
                "Tripartite power trade discussions",
            ],
        }
    ),
    visit(
        "npl-pm",
        ["2027-01-25", "2027-01-28"],
        "tokyo",
        "official_visit",
        "Official visit to Japan on development partnership and labour mobility",
        { status: "planned" }
    ),
    visit(
        "npl-president",
        ["2026-03-23", "2026-03-26"],
        "new-delhi",
        "state_visit",
        "State visit to India at the invitation of the President of India"
    ),
    visit(
        "npl-president",
        ["2026-06-08", "2026-06-10"],
        "thimphu",
        "state_visit",
        "State visit to Bhutan"
    ),
    visit(
        "npl-fm",
        ["2025-10-06", "2025-10-08"],
        "new-delhi",
        "bilateral_meeting",
        "Nepal–India Joint Commission meeting",
        {
            engagements: [
                "Co-chairing the Joint Commission with the Minister of External Affairs",
                "Review of connectivity and energy projects",
            ],
        }
    ),
    visit(
        "npl-fm",
        ["2026-01-14", "2026-01-16"],
        "beijing",
        "diplomatic_visit",
        "Diplomatic consultations with China on trade, transit and civil aviation"
    ),
    visit(
        "npl-fm",
        ["2026-02-23", "2026-02-25"],
        "geneva",
        "conference",
        "High-level segment of the UN Human Rights Council"
    ),
    visit(
        "npl-fm",
        ["2026-10-19", "2026-10-21"],
        "canberra",
        "official_visit",
        "Official visit to Australia on education, labour mobility and trade"
    ),
    visit(
        "npl-finance",
        ["2026-03-09", "2026-03-11"],
        "doha",
        "other",
        "Investment promotion roadshow for Nepal's infrastructure and hydropower sectors"
    ),
    visit(
        "npl-foreign-secretary",
        ["2025-07-21", "2025-07-22"],
        "new-delhi",
        "bilateral_meeting",
        "Foreign Secretary-level consultations with India"
    ),
    visit(
        "npl-foreign-secretary",
        ["2026-04-20", "2026-04-21"],
        "beijing",
        "diplomatic_visit",
        "Diplomatic consultation mechanism meeting with China"
    ),
    visit(
        "npl-foreign-secretary",
        ["2026-11-16", "2026-11-17"],
        "dhaka",
        "bilateral_meeting",
        "Foreign Secretary-level consultations with Bangladesh"
    ),

    // India
    visit(
        "ind-pm",
        ["2025-02-12", "2025-02-13"],
        "washington",
        "official_visit",
        "Official working visit to the United States on trade, technology and defence",
        {
            engagements: [
                "Talks with the President of the United States",
                "Meetings with technology industry leaders",
                "Joint statement on a trade framework",
            ],
        }
    ),
    visit(
        "ind-pm",
        ["2025-04-22", "2025-04-23"],
        "jeddah",
        "state_visit",
        "State visit to Saudi Arabia, cut short following a security incident at home"
    ),
    visit(
        "ind-pm",
        ["2025-07-02", "2025-07-03"],
        "accra",
        "official_visit",
        "Official visit to Ghana on trade and development partnership"
    ),
    visit(
        "ind-pm",
        ["2025-08-29", "2025-08-30"],
        "tokyo",
        "official_visit",
        "Annual India–Japan summit",
        {
            engagements: [
                "Annual summit with the Prime Minister of Japan",
                "Visit to a semiconductor manufacturing facility",
            ],
        }
    ),
    visit(
        "ind-pm",
        ["2026-08-24", "2026-08-25"],
        "kathmandu",
        "official_visit",
        "Official visit to Nepal for the India–Nepal summit",
        {
            engagements: [
                "Talks with the Prime Minister of Nepal",
                "Inauguration of a cross-border transmission line",
                "Address to the Nepal–India business forum",
            ],
        }
    ),
    visit(
        "ind-pm",
        ["2026-11-23", "2026-11-25"],
        "canberra",
        "official_visit",
        "Official visit to Australia for the annual leaders' summit"
    ),
    visit(
        "ind-pm",
        ["2027-02-08", "2027-02-10"],
        "berlin",
        "official_visit",
        "Intergovernmental consultations with Germany",
        { status: "planned" }
    ),
    visit(
        "ind-president",
        ["2025-10-06", "2025-10-09"],
        "hanoi",
        "state_visit",
        "State visit to Vietnam"
    ),
    visit(
        "ind-president",
        ["2026-05-18", "2026-05-21"],
        "lisbon",
        "state_visit",
        "State visit to Portugal"
    ),
    visit(
        "ind-eam",
        ["2025-05-19", "2025-05-21"],
        "the-hague",
        "official_visit",
        "Official visit to the Netherlands on trade, water management and semiconductors"
    ),
    visit(
        "ind-eam",
        ["2026-01-06", "2026-01-07"],
        "kathmandu",
        "official_visit",
        "Official visit to Nepal to review bilateral cooperation"
    ),
    visit(
        "ind-eam",
        ["2026-10-08", "2026-10-10"],
        "riyadh",
        "multilateral_meeting",
        "Ministerial meeting of the India–Saudi Arabia Strategic Partnership Council"
    ),
    visit(
        "ind-eam",
        ["2026-12-02", "2026-12-03"],
        "colombo",
        "official_visit",
        "Official visit to Sri Lanka"
    ),
    visit(
        "ind-commerce",
        ["2025-07-23", "2025-07-24"],
        "london",
        "bilateral_meeting",
        "Signing of the India–United Kingdom trade agreement"
    ),
    visit(
        "ind-commerce",
        ["2026-03-02", "2026-03-04"],
        "washington",
        "bilateral_meeting",
        "Trade negotiations with the United States Trade Representative"
    ),
    visit(
        "ind-foreign-secretary",
        ["2025-11-10", "2025-11-11"],
        "kathmandu",
        "bilateral_meeting",
        "Foreign Secretary-level dialogue with Nepal"
    ),
    visit(
        "ind-foreign-secretary",
        ["2026-03-17", "2026-03-18"],
        "dhaka",
        "bilateral_meeting",
        "Foreign Office Consultations with Bangladesh"
    ),

    // Bangladesh
    visit(
        "bgd-chief-adviser",
        ["2025-03-26", "2025-03-29"],
        "beijing",
        "official_visit",
        "Official visit to China on investment, water management and health cooperation"
    ),
    visit(
        "bgd-chief-adviser",
        ["2025-05-28", "2025-05-31"],
        "tokyo",
        "conference",
        "Nikkei Future of Asia forum and talks with the Government of Japan"
    ),
    visit(
        "bgd-chief-adviser",
        ["2025-06-10", "2025-06-13"],
        "london",
        "official_visit",
        "Official visit to the United Kingdom"
    ),
    visit(
        "bgd-pm",
        ["2026-04-14", "2026-04-16"],
        "new-delhi",
        "official_visit",
        "First official visit to India after assuming office"
    ),
    visit(
        "bgd-pm",
        ["2026-12-07", "2026-12-10"],
        "beijing",
        "official_visit",
        "Official visit to China",
        { status: "planned" }
    ),
    visit(
        "bgd-fm",
        ["2026-08-03", "2026-08-04"],
        "kathmandu",
        "bilateral_meeting",
        "Nepal–Bangladesh Joint Consultative Commission"
    ),

    // Sri Lanka
    visit(
        "lka-president",
        ["2024-12-15", "2024-12-17"],
        "new-delhi",
        "state_visit",
        "State visit to India, the first overseas visit after taking office"
    ),
    visit(
        "lka-president",
        ["2025-01-14", "2025-01-17"],
        "beijing",
        "state_visit",
        "State visit to China"
    ),
    visit(
        "lka-president",
        ["2025-09-27", "2025-09-30"],
        "tokyo",
        "official_visit",
        "Official visit to Japan"
    ),
    visit(
        "lka-pm",
        ["2025-10-16", "2025-10-18"],
        "new-delhi",
        "official_visit",
        "Official visit to India"
    ),
    visit(
        "lka-fm",
        ["2026-05-05", "2026-05-06"],
        "bangkok",
        "multilateral_meeting",
        "BIMSTEC Ministerial Meeting"
    ),

    // China
    visit(
        "chn-president",
        ["2025-04-14", "2025-04-15"],
        "hanoi",
        "state_visit",
        "State visit to Vietnam"
    ),
    visit(
        "chn-president",
        ["2025-04-15", "2025-04-17"],
        "kuala-lumpur",
        "state_visit",
        "State visit to Malaysia"
    ),
    visit(
        "chn-president",
        ["2025-05-07", "2025-05-10"],
        "moscow",
        "state_visit",
        "State visit to Russia and Victory Day commemorations"
    ),
    visit(
        "chn-president",
        ["2025-06-16", "2025-06-18"],
        "astana",
        "summit",
        "China–Central Asia Summit"
    ),
    visit(
        "chn-premier",
        ["2025-05-24", "2025-05-26"],
        "jakarta",
        "official_visit",
        "Official visit to Indonesia"
    ),
    visit(
        "chn-premier",
        ["2026-06-29", "2026-07-02"],
        "berlin",
        "official_visit",
        "China–Germany intergovernmental consultations"
    ),
    visit(
        "chn-premier",
        ["2026-10-21", "2026-10-23"],
        "islamabad",
        "multilateral_meeting",
        "SCO Council of Heads of Government meeting and official visit to Pakistan"
    ),
    visit(
        "chn-fm",
        ["2025-08-17", "2025-08-19"],
        "new-delhi",
        "bilateral_meeting",
        "Special Representatives' talks on the boundary question"
    ),
    visit(
        "chn-fm",
        ["2026-03-24", "2026-03-25"],
        "kathmandu",
        "official_visit",
        "Official visit to Nepal on trade, transit and connectivity"
    ),
    visit(
        "chn-fm",
        ["2027-01-07", "2027-01-09"],
        "addis-ababa",
        "official_visit",
        "Annual new-year visit to Africa, beginning with the African Union",
        { status: "planned" }
    ),
    visit(
        "chn-commerce",
        ["2025-05-10", "2025-05-11"],
        "geneva",
        "bilateral_meeting",
        US_CHINA_TALKS
    ),
    visit(
        "chn-commerce",
        ["2025-06-09", "2025-06-10"],
        "london",
        "bilateral_meeting",
        US_CHINA_TALKS
    ),
    visit(
        "chn-commerce",
        ["2025-07-28", "2025-07-29"],
        "stockholm",
        "bilateral_meeting",
        US_CHINA_TALKS
    ),

    // Japan
    visit(
        "jpn-pm-2024",
        ["2025-01-09", "2025-01-10"],
        "kuala-lumpur",
        "official_visit",
        "Official visit to Malaysia"
    ),
    visit(
        "jpn-pm-2024",
        ["2025-01-10", "2025-01-12"],
        "jakarta",
        "official_visit",
        "Official visit to Indonesia"
    ),
    visit(
        "jpn-pm-2024",
        ["2025-02-06", "2025-02-08"],
        "washington",
        "official_visit",
        "Official visit to the United States and first summit with the new administration"
    ),
    visit(
        "jpn-pm-2024",
        ["2025-04-28", "2025-04-29"],
        "hanoi",
        "official_visit",
        "Official visit to Vietnam"
    ),
    visit(
        "jpn-pm-2024",
        ["2025-04-29", "2025-04-30"],
        "manila",
        "official_visit",
        "Official visit to the Philippines"
    ),
    visit(
        "jpn-pm",
        ["2026-01-13", "2026-01-14"],
        "seoul",
        "bilateral_meeting",
        "Japan–Korea summit under shuttle diplomacy"
    ),
    visit(
        "jpn-pm",
        ["2026-03-18", "2026-03-20"],
        "washington",
        "official_visit",
        "Official visit to the United States"
    ),
    visit(
        "jpn-fm",
        ["2026-01-20", "2026-01-21"],
        "beijing",
        "bilateral_meeting",
        "Japan–China foreign ministers' meeting, postponed indefinitely",
        { status: "cancelled" }
    ),

    // South Korea
    visit(
        "kor-president",
        ["2025-08-23", "2025-08-24"],
        "tokyo",
        "bilateral_meeting",
        "Japan–Korea summit"
    ),
    visit(
        "kor-president",
        ["2025-08-24", "2025-08-26"],
        "washington",
        "official_visit",
        "Official visit to the United States"
    ),
    visit(
        "kor-president",
        ["2026-01-04", "2026-01-07"],
        "beijing",
        "state_visit",
        "State visit to China"
    ),
    visit(
        "kor-pm",
        ["2026-05-20", "2026-05-22"],
        "jakarta",
        "official_visit",
        "Official visit to Indonesia"
    ),
    visit(
        "kor-fm",
        ["2025-07-31", "2025-08-01"],
        "washington",
        "bilateral_meeting",
        "Foreign ministers' talks with the United States"
    ),
    visit(
        "kor-fm",
        ["2026-10-28", "2026-10-29"],
        "tokyo",
        "bilateral_meeting",
        "Japan–Korea foreign ministers' meeting"
    ),

    // Indonesia
    visit(
        "idn-president",
        ["2025-01-25", "2025-01-26"],
        "new-delhi",
        "state_visit",
        "Chief guest at India's Republic Day celebrations"
    ),
    visit(
        "idn-president",
        ["2025-04-09", "2025-04-10"],
        "abu-dhabi",
        "official_visit",
        "Official visit to the United Arab Emirates"
    ),
    visit(
        "idn-president",
        ["2025-07-12", "2025-07-14"],
        "paris",
        "state_visit",
        "Guest of honour at France's national day celebrations"
    ),
    visit(
        "idn-president",
        ["2026-12-02", "2026-12-04"],
        "tokyo",
        "state_visit",
        "State visit to Japan",
        { status: "planned" }
    ),

    // Türkiye
    visit(
        "tur-president",
        ["2025-02-10", "2025-02-11"],
        "kuala-lumpur",
        "official_visit",
        "Official visit to Malaysia"
    ),
    visit(
        "tur-president",
        ["2025-02-11", "2025-02-12"],
        "jakarta",
        "state_visit",
        "State visit to Indonesia"
    ),
    visit(
        "tur-president",
        ["2025-02-12", "2025-02-13"],
        "islamabad",
        "state_visit",
        "State visit to Pakistan"
    ),

    // United Kingdom
    visit(
        "gbr-pm",
        ["2025-02-26", "2025-02-27"],
        "washington",
        "official_visit",
        "Official visit to the United States"
    ),
    visit(
        "gbr-pm",
        ["2025-05-10", "2025-05-10"],
        "kyiv",
        "diplomatic_visit",
        "Joint visit to Kyiv with European leaders"
    ),
    visit(
        "gbr-pm",
        ["2025-05-16", "2025-05-16"],
        "tirana",
        "summit",
        "European Political Community summit"
    ),
    visit(
        "gbr-pm",
        ["2025-10-08", "2025-10-09"],
        "mumbai",
        "official_visit",
        "Trade mission to India",
        {
            engagements: [
                "Talks with the Prime Minister of India",
                "Trade and investment roundtable with business leaders",
            ],
        }
    ),
    visit(
        "gbr-pm",
        ["2026-01-28", "2026-01-31"],
        "beijing",
        "official_visit",
        "Official visit to China"
    ),
    visit(
        "gbr-pm",
        ["2026-03-26", "2026-03-28"],
        "tokyo",
        "official_visit",
        "Official visit to Japan, cancelled to attend a parliamentary vote",
        { status: "cancelled" }
    ),
    visit(
        "gbr-foreign-secretary",
        ["2025-12-03", "2025-12-04"],
        "kyiv",
        "diplomatic_visit",
        "Visit to Ukraine on security guarantees and reconstruction"
    ),
    visit(
        "gbr-home-secretary",
        ["2025-03-18", "2025-03-19"],
        "kyiv",
        "diplomatic_visit",
        "Visit to Ukraine as Foreign Secretary"
    ),
    visit(
        "gbr-home-secretary",
        ["2025-11-04", "2025-11-05"],
        "paris",
        "bilateral_meeting",
        "UK–France talks on migration and border security"
    ),
    visit(
        "gbr-chancellor",
        ["2025-01-11", "2025-01-12"],
        "beijing",
        "bilateral_meeting",
        "UK–China Economic and Financial Dialogue"
    ),

    // France
    visit(
        "fra-president",
        ["2025-05-10", "2025-05-10"],
        "kyiv",
        "diplomatic_visit",
        "Joint visit to Kyiv with European leaders"
    ),
    visit(
        "fra-president",
        ["2025-05-26", "2025-05-27"],
        "hanoi",
        "state_visit",
        "State visit to Vietnam"
    ),
    visit(
        "fra-president",
        ["2025-05-28", "2025-05-29"],
        "jakarta",
        "state_visit",
        "State visit to Indonesia"
    ),
    visit(
        "fra-president",
        ["2025-05-30", "2025-05-30"],
        "singapore",
        "conference",
        "Keynote address at the Shangri-La Dialogue"
    ),

    // Germany
    visit(
        "deu-chancellor",
        ["2025-05-07", "2025-05-07"],
        "paris",
        "official_visit",
        "Inaugural visit to France after taking office"
    ),
    visit(
        "deu-chancellor",
        ["2025-05-07", "2025-05-07"],
        "warsaw",
        "official_visit",
        "Inaugural visit to Poland after taking office"
    ),
    visit(
        "deu-chancellor",
        ["2025-05-10", "2025-05-10"],
        "kyiv",
        "diplomatic_visit",
        "Joint visit to Kyiv with European leaders"
    ),
    visit(
        "deu-chancellor",
        ["2025-06-05", "2025-06-05"],
        "washington",
        "official_visit",
        "Official visit to the United States"
    ),
    visit(
        "deu-chancellor",
        ["2026-01-12", "2026-01-14"],
        "new-delhi",
        "official_visit",
        "Official visit to India"
    ),
    visit(
        "deu-chancellor",
        ["2026-02-24", "2026-02-26"],
        "beijing",
        "official_visit",
        "Official visit to China"
    ),

    // Italy
    visit(
        "ita-pm",
        ["2025-04-17", "2025-04-17"],
        "washington",
        "official_visit",
        "Official visit to the United States"
    ),
    visit(
        "ita-pm",
        ["2026-01-15", "2026-01-16"],
        "tokyo",
        "official_visit",
        "Official visit to Japan"
    ),

    // Ukraine
    visit(
        "ukr-president",
        ["2025-02-28", "2025-02-28"],
        "washington",
        "official_visit",
        "Official visit to the United States"
    ),
    visit(
        "ukr-president",
        ["2025-08-18", "2025-08-18"],
        "washington",
        "multilateral_meeting",
        "Talks at the White House with European leaders"
    ),
    visit(
        "ukr-president",
        ["2025-12-08", "2025-12-08"],
        "london",
        "multilateral_meeting",
        "Talks with British, French and German leaders on a peace framework"
    ),
    visit(
        "ukr-president",
        ["2026-10-22", "2026-10-23"],
        "brussels",
        "summit",
        "European Council meeting on accession and reconstruction"
    ),
    visit(
        "ukr-pm",
        ["2026-03-09", "2026-03-10"],
        "brussels",
        "multilateral_meeting",
        "EU–Ukraine Association Council"
    ),

    // United States
    visit(
        "usa-president",
        ["2025-05-13", "2025-05-14"],
        "riyadh",
        "state_visit",
        "State visit to Saudi Arabia"
    ),
    visit(
        "usa-president",
        ["2025-05-14", "2025-05-15"],
        "doha",
        "state_visit",
        "State visit to Qatar"
    ),
    visit(
        "usa-president",
        ["2025-05-15", "2025-05-16"],
        "abu-dhabi",
        "state_visit",
        "State visit to the United Arab Emirates"
    ),
    visit(
        "usa-president",
        ["2025-09-16", "2025-09-18"],
        "london",
        "state_visit",
        "State visit to the United Kingdom",
        {
            engagements: [
                "State welcome ceremony",
                "Talks with the Prime Minister",
                "State banquet",
            ],
        }
    ),
    visit(
        "usa-president",
        ["2025-10-27", "2025-10-28"],
        "tokyo",
        "official_visit",
        "Official visit to Japan"
    ),
    visit(
        "usa-president",
        ["2025-11-22", "2025-11-23"],
        "johannesburg",
        "summit",
        "G20 Leaders' Summit, boycotted by the administration",
        { eventName: "G20 Leaders' Summit", status: "cancelled" }
    ),
    visit(
        "usa-president",
        ["2026-04-14", "2026-04-16"],
        "beijing",
        "state_visit",
        "State visit to China"
    ),
    visit(
        "usa-vp",
        ["2025-04-21", "2025-04-24"],
        "new-delhi",
        "official_visit",
        "Official visit to India"
    ),
    visit(
        "usa-sos",
        ["2025-02-01", "2025-02-02"],
        "panama-city",
        "official_visit",
        "First overseas trip as Secretary of State, beginning in Panama"
    ),
    visit(
        "usa-sos",
        ["2026-10-20", "2026-10-22"],
        "new-delhi",
        "official_visit",
        "Official visit to India"
    ),
    visit(
        "usa-treasury",
        ["2025-05-10", "2025-05-11"],
        "geneva",
        "bilateral_meeting",
        US_CHINA_TALKS
    ),
    visit(
        "usa-treasury",
        ["2025-06-09", "2025-06-10"],
        "london",
        "bilateral_meeting",
        US_CHINA_TALKS
    ),
    visit(
        "usa-treasury",
        ["2025-07-28", "2025-07-29"],
        "stockholm",
        "bilateral_meeting",
        US_CHINA_TALKS
    ),
    visit("usa-trade", ["2025-05-10", "2025-05-11"], "geneva", "bilateral_meeting", US_CHINA_TALKS),

    // Canada
    visit(
        "can-pm",
        ["2025-03-17", "2025-03-17"],
        "paris",
        "official_visit",
        "First overseas trip as Prime Minister"
    ),
    visit(
        "can-pm",
        ["2025-03-17", "2025-03-18"],
        "london",
        "official_visit",
        "First overseas trip as Prime Minister"
    ),
    visit(
        "can-pm",
        ["2025-05-06", "2025-05-06"],
        "washington",
        "official_visit",
        "Official visit to the United States"
    ),
    visit("can-pm", ["2025-06-23", "2025-06-23"], "brussels", "summit", "EU–Canada Summit"),
    visit(
        "can-fm",
        ["2025-10-12", "2025-10-14"],
        "new-delhi",
        "official_visit",
        "Official visit to India to reset bilateral ties"
    ),

    // Brazil
    visit(
        "bra-president",
        ["2025-05-08", "2025-05-10"],
        "moscow",
        "official_visit",
        "Official visit to Russia and Victory Day commemorations"
    ),
    visit(
        "bra-president",
        ["2025-05-12", "2025-05-14"],
        "beijing",
        "state_visit",
        "State visit to China and the China–CELAC Forum"
    ),
    visit(
        "bra-president",
        ["2025-06-05", "2025-06-08"],
        "paris",
        "state_visit",
        "State visit to France"
    ),

    // South Africa
    visit(
        "zaf-president",
        ["2025-05-21", "2025-05-21"],
        "washington",
        "official_visit",
        "Official working visit to the United States"
    ),

    // Nigeria
    visit(
        "nga-president",
        ["2026-11-30", "2026-12-02"],
        "paris",
        "official_visit",
        "Official visit to France",
        { status: "planned" }
    ),

    // Kenya
    visit(
        "ken-president",
        ["2025-04-22", "2025-04-26"],
        "beijing",
        "state_visit",
        "State visit to China"
    ),
    visit(
        "ken-president",
        ["2026-11-02", "2026-11-04"],
        "london",
        "official_visit",
        "Official visit to the United Kingdom"
    ),

    // Egypt
    visit(
        "egy-president",
        ["2025-10-22", "2025-10-22"],
        "brussels",
        "summit",
        "First EU–Egypt Summit"
    ),
    visit(
        "egy-fm",
        ["2026-10-25", "2026-10-26"],
        "brussels",
        "multilateral_meeting",
        "EU–Egypt Association Council"
    ),

    // Australia
    visit(
        "aus-pm",
        ["2025-07-12", "2025-07-18"],
        "beijing",
        "official_visit",
        "Official visit to China"
    ),
    visit(
        "aus-pm",
        ["2025-10-20", "2025-10-20"],
        "washington",
        "official_visit",
        "Official visit to the United States"
    ),

    // New Zealand
    visit(
        "nzl-pm",
        ["2025-03-16", "2025-03-20"],
        "new-delhi",
        "official_visit",
        "Official visit to India and keynote at the Raisina Dialogue"
    ),
    visit(
        "nzl-pm",
        ["2025-06-17", "2025-06-20"],
        "beijing",
        "official_visit",
        "Official visit to China"
    ),
];

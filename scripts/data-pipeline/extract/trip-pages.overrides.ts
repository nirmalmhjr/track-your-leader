/**
 * Manual corrections to trip-page discovery, keyed by the official's Wikidata id.
 *
 * Discovery lists trip-list pages on every Wikipedia read ("List of international … trips made
 * by <name>", "Anexo:Viajes internacionales de <name>", …). If it misses a page (a title naming
 * the office or the government instead of the person) or picks a wrong one, fix it here; `data/warehouse/report.json`
 * lists the pages found for each official after every run. Pages on other Wikipedias start
 * with their language code, e.g. "fr:Liste des visites d'État du roi Albert II de Belgique".
 * "received:" marks a country's list of state visits it hosted; it goes with any official of
 * that country (only the host country is read from them), and its rows become trips of each
 * visiting head of state.
 *
 * @example
 * Q1058: { add: ["List of international prime ministerial trips made by Narendra Modi"] },
 */
export const TRIP_PAGE_OVERRIDES: Readonly<
    Record<string, { add?: readonly string[]; exclude?: readonly string[] }>
> = {
    Q22686: {
        add: [
            "received:List of diplomatic visits to the United States: Africa",
            "received:List of diplomatic visits to the United States: Asia",
            "received:List of diplomatic visits to the United States: Europe",
            "received:List of diplomatic visits to the United States: North America and the Caribbean",
            "received:List of diplomatic visits to the United States: Oceania",
            "received:List of diplomatic visits to the United States: South America",
        ],
    },
    // Japan's Emperors: their articles' "世界各国訪問歴" tables list every visit abroad.
    Q34479: { add: ["ja:昭和天皇"] },
    Q37979: { add: ["ja:明仁"] },
    // Countries' lists of the state visits they hosted, from every country.
    Q43274: { add: ["received:List of state visits to the United Kingdom"] },
    Q57373: {
        add: [
            "received:List of diplomatic visits to Pakistan",
            "received:List of diplomatic visits to Pakistan since 2024",
        ],
    },
    Q217096: { add: ["ja:徳仁"] },
    // Popes receive leaders of every country.
    Q450675: { add: ["received:List of diplomatic visits to the Holy See under Pope Francis"] },
    Q983324: {
        add: [
            "received:List of state visits to the Philippines",
            "received:List of diplomatic visits to the Philippines",
        ],
    },
    // Masoud Pezeshkian: listed as the trips of Iran's "14th government" and "14th president".
    Q5933752: {
        add: [
            "fa:سفرهای خارجی دولت چهاردهم",
            "ar:قائمة الرحلات الخارجية للرئيس الرابع عشر لإيران",
            "received:List of state visits to Iran",
            "received:List of diplomatic visits to Iran",
        ],
    },
    Q6109517: { add: ["received:List of diplomatic visits to the Holy See under Pope Leo XIV"] },
    Q6496078: { add: ["received:List of diplomatic visits to Iraq"] },
    Q12277168: { add: ["received:List of state visits to Macedonia"] },
    // Al-Sultan Abdullah, King of Malaysia 2019–2024 (the list names him more briefly).
    Q15467111: { add: ["ms:Senarai lawatan antarabangsa oleh Al-Sultan Abdullah"] },
    Q19901232: { add: ["received:List of state visits to India"] },
};

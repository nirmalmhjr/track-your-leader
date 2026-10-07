import assert from "node:assert/strict";
import { test } from "node:test";

import { classifyTripPage } from "../extract/trip-pages.discover";

test("trip-list titles name their subject and direction", () => {
    const cases: [string, ReturnType<typeof classifyTripPage>][] = [
        [
            "List of international prime ministerial trips made by Narendra Modi",
            { direction: "outgoing", subject: "narendra modi" },
        ],
        [
            "List of international trips made by Marco Rubio as United States Secretary of State",
            { direction: "outgoing", subject: "marco rubio" },
        ],
        [
            "List of official overseas trips made by Birendra of Nepal",
            { direction: "outgoing", subject: "birendra of nepal" },
        ],
        [
            "List of state visits made by Elizabeth II",
            { direction: "outgoing", subject: "elizabeth ii" },
        ],
        [
            "List of state visits made and received by Harald V",
            { direction: "outgoing", subject: "harald v" },
        ],
        [
            "List of presidential trips made by Emmanuel Macron",
            { direction: "outgoing", subject: "emmanuel macron" },
        ],
        // Yearly US pages are mostly domestic travel.
        ["List of presidential trips made by Barack Obama (2009)", null],
        ["List of state visits received by Akihito", { direction: "received", subject: "akihito" }],
        [
            "List of vice presidential trips made by JD Vance",
            { direction: "outgoing", subject: "jd vance" },
        ],
        [
            "List of Commonwealth official trips made by Charles III",
            { direction: "outgoing", subject: "charles iii" },
        ],
        [
            "List of international visits made by Nicola Sturgeon",
            { direction: "outgoing", subject: "nicola sturgeon" },
        ],
        ["List of domestic trips made by Narendra Modi", null],
        ["List of papal visits to Africa", null],
        ["List of international presidential trips made by Joe Biden (domestic)", null],
        ["List of international organisations", null],
    ];
    for (const [title, expected] of cases) {
        assert.deepEqual(classifyTripPage(title), expected, title);
    }
});

test("Spanish and French trip-list titles drop the office before the name", () => {
    const cases: [string, "es" | "fr", ReturnType<typeof classifyTripPage>][] = [
        [
            "Anexo:Viajes internacionales del presidente José Mujica",
            "es",
            { direction: "outgoing", subject: "jose mujica" },
        ],
        [
            "Anexo:Viajes internacionales de la presidenta Claudia Sheinbaum",
            "es",
            { direction: "outgoing", subject: "claudia sheinbaum" },
        ],
        [
            "Anexo:Visitas oficiales al exterior del rey Harald V de Noruega",
            "es",
            { direction: "outgoing", subject: "harald v de noruega" },
        ],
        [
            "Liste des voyages officiels effectués par Kim Jong-il",
            "fr",
            { direction: "outgoing", subject: "kim jong il" },
        ],
        [
            "Liste des voyages présidentiels d'Ilham Aliyev",
            "fr",
            { direction: "outgoing", subject: "ilham aliyev" },
        ],
        [
            "Liste des visites d'État reçues par le roi Philippe de Belgique",
            "fr",
            { direction: "received", subject: "philippe de belgique" },
        ],
        ["Liste des voyages de Corto Maltese", "fr", null],
    ];
    for (const [title, language, expected] of cases) {
        assert.deepEqual(classifyTripPage(title, language), expected, title);
    }
});

test("trip-list titles on the other Wikipedias", () => {
    const cases: [string, "pt" | "de" | "id" | "ko" | "ar" | "fa", string | null][] = [
        ["Lista de viagens presidenciais de Santiago Peña", "pt", "santiago pena"],
        ["Lista de viagens primo-ministeriais de Liz Truss", "pt", "liz truss"],
        ["Liste der Auslandsreisen von Bundespräsident Joachim Gauck", "de", "joachim gauck"],
        ["Liste der Staatsbesuche in Deutschland", "de", null],
        ["Daftar kunjungan kenegaraan Joko Widodo", "id", "joko widodo"],
        ["Daftar kunjungan kepausan ke Amerika Serikat", "id", null],
        ["이재명의 대통령 순방 목록", "ko", "이재명"],
        ["قائمة رحلات برهم صالح الخارجية", "ar", "برهم صالح"],
        ["فهرست سفرهای خارجی نیکول پاشینیان، نخست\u200cوزیر ارمنستان", "fa", "نیکول پاشینیان"],
        ["فهرست سفرهای دولتی به ایران", "fa", null],
    ];
    for (const [title, language, subject] of cases) {
        assert.equal(classifyTripPage(title, language)?.subject ?? null, subject, title);
    }
});

test("Dutch, Norwegian and Swedish lists of a monarch's state visits", () => {
    assert.deepEqual(
        classifyTripPage("Lijst van staatsbezoeken van Willem-Alexander der Nederlanden", "nl"),
        {
            direction: "outgoing",
            subject: "willem alexander der nederlanden",
        }
    );
    assert.deepEqual(classifyTripPage("Liste over statsbesøk under Harald V", "no"), {
        direction: "outgoing",
        subject: "harald v",
    });
    assert.deepEqual(
        classifyTripPage("Lista över statsbesök av Carl XVI Gustaf av Sverige", "sv"),
        {
            direction: "outgoing",
            subject: "carl xvi gustaf av sverige",
        }
    );
});

test("Japanese lists name the person first", () => {
    assert.deepEqual(
        classifyTripPage("ジョー・バイデン大統領の外遊の一覧", "ja")?.direction,
        "outgoing"
    );
    assert.deepEqual(
        classifyTripPage("岸田文雄の外遊", "ja")?.subject,
        classifyTripPage("岸田文雄の外遊の一覧", "ja")?.subject
    );
});

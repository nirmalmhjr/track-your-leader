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

import assert from "node:assert/strict";
import { test } from "node:test";

import { parliamentPortrait } from "../sources/parliament-portraits";
import { isPortraitFile } from "../sources/wikipedia";

test("articles' lead images count as photos unless they are flags, arms, signatures or maps", () => {
    assert.equal(isPortraitFile("Ahmed_al-Sharaa,_President_of_Syria,_in_March_2026.jpg"), true);
    assert.equal(isPortraitFile("Denise_Bronzetti.jpg"), true);
    assert.equal(isPortraitFile("Flag_of_Afghanistan.svg"), false);
    assert.equal(isPortraitFile("Coat_of_arms_of_San_Marino.png"), false);
    assert.equal(isPortraitFile("Signature_of_Hibatullah_Akhundzada.png"), false);
    assert.equal(isPortraitFile("Location_map_Syria.png"), false);
});

test("official parliamentary portraits come from the members' ids", () => {
    assert.equal(
        parliamentPortrait({ usCongress: "P000197" }),
        "https://unitedstates.github.io/images/congress/225x275/P000197.jpg"
    );
    assert.equal(
        parliamentPortrait({ ukParliament: "4514" }),
        "https://members-api.parliament.uk/api/Members/4514/Thumbnail"
    );
    assert.equal(parliamentPortrait({ ukParliament: "not-an-id", usCongress: null }), null);
});

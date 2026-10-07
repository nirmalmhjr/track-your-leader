import assert from "node:assert/strict";
import { test } from "node:test";

import { isPortraitFile } from "../sources/wikipedia";

test("articles' lead images count as photos unless they are flags, arms, signatures or maps", () => {
    assert.equal(isPortraitFile("Ahmed_al-Sharaa,_President_of_Syria,_in_March_2026.jpg"), true);
    assert.equal(isPortraitFile("Denise_Bronzetti.jpg"), true);
    assert.equal(isPortraitFile("Flag_of_Afghanistan.svg"), false);
    assert.equal(isPortraitFile("Coat_of_arms_of_San_Marino.png"), false);
    assert.equal(isPortraitFile("Signature_of_Hibatullah_Akhundzada.png"), false);
    assert.equal(isPortraitFile("Location_map_Syria.png"), false);
});

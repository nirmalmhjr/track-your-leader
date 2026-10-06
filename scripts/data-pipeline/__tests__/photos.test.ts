import assert from "node:assert/strict";
import { test } from "node:test";

import {
    findUnreliablePhotos,
    originalPhotoOf,
    type PhotoEntry,
    photoFileOf,
} from "../extract/photos.check";

const url = (file: string, width = 160) =>
    `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file.replaceAll(" ", "_"))}?width=${width}`;

const entry = (wikidataId: string, name: string, file: string | null): PhotoEntry => ({
    aliases: [],
    name,
    photoUrl: file ? url(file) : null,
    wikidataId,
});

const WIFE_PHOTO = "ओनसरी घर्तिमगर पतिसँग (cropped).jpg";

test("a photo file is the same whatever thumbnail width is asked for", () => {
    assert.equal(photoFileOf(url("Ram Baran Yadav.jpg", 80)), "Ram Baran Yadav.jpg");
    assert.equal(photoFileOf(url("Ram Baran Yadav.jpg")), "Ram Baran Yadav.jpg");
});

test("a photo shared by people its file name doesn't name is dropped for them all", () => {
    const barsaman = entry("Q15427968", "Barsaman Pun", WIFE_PHOTO);
    const onsari = entry("Q21129921", "Onsari Gharti Magar", WIFE_PHOTO);
    const cabinet = [
        entry("Q1", "K. T. Jacob", "Kerala Council of Ministers 1969.jpg"),
        entry("Q2", "P. Ravindran", "Kerala Council of Ministers 1969.jpg"),
    ];
    const { dropped, ids } = findUnreliablePhotos([barsaman, onsari, ...cabinet], {});
    assert.deepEqual([...ids].sort(), ["Q1", "Q15427968", "Q2", "Q21129921"]);
    assert.equal(dropped.length, 2);
});

test("a cropped or restored copy counts as the same photo as its original", () => {
    assert.equal(originalPhotoOf(WIFE_PHOTO), "ओनसरी घर्तिमगर पतिसँग.jpg");
    assert.equal(
        originalPhotoOf("Birendra Bir Bikram Shah c. 1967 (restoration).jpg"),
        "Birendra Bir Bikram Shah c. 1967.jpg"
    );
    assert.equal(originalPhotoOf("Group photo (2).jpg"), "Group photo (2).jpg");

    const { ids } = findUnreliablePhotos([
        entry("Q15427968", "Barsaman Pun", WIFE_PHOTO),
        entry("Q21129921", "Onsari Gharti Magar", originalPhotoOf(WIFE_PHOTO)),
    ]);
    assert.deepEqual([...ids], ["Q15427968"]);
});

test("a shared photo stays with the person its file name names", () => {
    const { ids } = findUnreliablePhotos(
        [
            entry("Q1", "Baldev Singh", "1948 CR Baldev Singh Chiefs of Staff.JPG"),
            entry("Q2", "Roy Bucher", "1948 CR Baldev Singh Chiefs of Staff.JPG"),
            entry("Q3", "Ram Baran Yadav", "Ram Baran Yadav.jpg"),
        ],
        {}
    );
    assert.deepEqual([...ids], ["Q2"]);
});

test("overrides keep or block a photo whatever the check decides", () => {
    const { ids } = findUnreliablePhotos(
        [
            entry("Q15427968", "Barsaman Pun", WIFE_PHOTO),
            entry("Q21129921", "Onsari Gharti Magar", WIFE_PHOTO),
            entry("Q3", "Ram Baran Yadav", "Someone else.jpg"),
        ],
        { Q3: "block", Q21129921: "keep" }
    );
    assert.deepEqual([...ids].sort(), ["Q15427968", "Q3"]);
});

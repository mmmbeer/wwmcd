import assert from "node:assert/strict";
import test from "node:test";

import {
  findBestiaryOptionByName,
  getBestiaryOptions
} from "../js/player-combat/data/bestiaryOptions.js";
import { listAvailableReferenceFiles } from "../js/player-combat/data/referenceDataLoader.js";
import { renderCreatureSelector } from "../js/player-combat/ui/aiRecommendationModal.js";

test("reference data loader includes Monster Manual bestiary data", () => {
  assert.ok(listAvailableReferenceFiles().some((file) => file.name === "bestiary-mm"));
});

test("bestiary options expose searchable creature names without stat details", () => {
  const adultRedDragon = {
    name: "Adult Red Dragon",
    source: "MM",
    page: 98,
    ac: [19],
    hp: { average: 256 }
  };
  const options = getBestiaryOptions({
    data: {
      "bestiary-mm": {
        monster: [adultRedDragon]
      }
    }
  });

  assert.equal(options[0].name, "Adult Red Dragon");
  assert.equal(findBestiaryOptionByName(options, "adult red dragon").creature, adultRedDragon);
});

test("creature selector renders name-only datalist and removable badge", () => {
  const html = renderCreatureSelector(
    [{ name: "Adult Red Dragon", creature: { ac: [19] } }],
    { name: "Adult Red Dragon" }
  );

  assert.match(html, /data-ai-creature-input/);
  assert.match(html, /<option value="Adult Red Dragon"><\/option>/);
  assert.match(html, /data-ai-remove-creature/);
  assert.doesNotMatch(html, /19/);
});

import assert from "node:assert/strict";
import test from "node:test";

import { renderRecommendationOptionsControls } from "../js/player-combat/ui/recommendationOptionsModal.js";

test("recommendation options modal keeps resources in advanced options", () => {
  const html = renderRecommendationOptionsControls({
    spells: [{
      id: "spell_bless",
      name: "Bless",
      source: "spell",
      available: true,
      cost: { action: true, resource: { type: "spellSlot", level: 1 } },
      spell: { level: 1, concentration: true }
    }]
  }, {});

  const advancedStart = html.indexOf("Advanced options");
  const resourcesStart = html.indexOf("Resources");
  const goalStart = html.indexOf("Goal");

  assert.ok(advancedStart > -1);
  assert.ok(goalStart > -1 && goalStart < advancedStart);
  assert.ok(resourcesStart > advancedStart);
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  renderRecommendationWizardPanel,
  resetRecommendationAnswers
} from "../js/player-combat/ui/recommendationWizardPanel.js";

test("recommendation wizard summary hides advanced answers", () => {
  resetRecommendationAnswers();
  const html = renderRecommendationWizardPanel({
    spells: [{
      id: "spell_bless",
      name: "Bless",
      source: "spell",
      available: true,
      cost: { action: true, resource: { type: "spellSlot", level: 1 } },
      spell: { level: 1, concentration: true }
    }]
  }, [], {});

  assert.match(html, /Goal/);
  assert.match(html, /Situation/);
  assert.match(html, /Range/);
  assert.doesNotMatch(html, /Resources/);
  assert.doesNotMatch(html, /Concentration/);
  assert.doesNotMatch(html, /Rolls/);
  assert.doesNotMatch(html, /DC/);
});

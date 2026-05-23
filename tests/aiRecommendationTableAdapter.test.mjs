import assert from "node:assert/strict";
import test from "node:test";
import { recommendationTableOptions } from "../js/player-combat/ui/aiRecommendationTableAdapter.js";

test("AI recommendations are merged into the procedural recommendation table options", () => {
  const attack = option("attack_rapier", "Rapier");
  const dodge = option("basic_dodge", "Dodge");
  const merged = recommendationTableOptions(
    [
      { option: attack },
      { option: dodge }
    ],
    {
      guidance: "Finish the low-health enemy before it acts.",
      missingInfo: ["enemy AC"],
      recommendations: [{
        rank: 1,
        optionId: "attack_rapier",
        score: 92,
        summary: "Best pressure option.",
        confidence: "high",
        legality: "conditional",
        riskLevel: "low",
        reasons: ["Strong damage"],
        warnings: ["Confirm range."],
        assumptions: ["Target is visible."],
        resourcesUsed: [],
        concentrationImpact: "none"
      }]
    },
    { attacks: [attack], actions: [dodge] }
  );

  assert.equal(merged.length, 2);
  assert.equal(merged[0].id, "attack_rapier");
  assert.equal(merged[0].recommendation.source, "ai");
  assert.equal(merged[0].recommendation.guidance, "Finish the low-health enemy before it acts.");
  assert.deepEqual(merged[0].recommendation.reasons, ["Strong damage"]);
  assert.match(merged[0].recommendation.warnings.join(" "), /enemy AC/);
  assert.equal(merged[1].id, "basic_dodge");
});

function option(id, name) {
  return {
    id,
    name,
    source: "basic",
    cost: { action: true },
    available: true,
    rolls: []
  };
}

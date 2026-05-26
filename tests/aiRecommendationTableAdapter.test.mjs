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
        goalFit: "Best damage plan.",
        expectedOutcome: "Reliable hit plus rider.",
        summary: "Best pressure option.",
        confidence: "high",
        legality: "conditional",
        riskLevel: "low",
        reasons: ["Strong damage"],
        warnings: ["Confirm range."],
        pieces: [
          { slot: "Action", optionId: "attack_rapier", name: "Rapier", explanation: "Attack the target." },
          { slot: "Rider", optionId: "feature_sneak_attack", name: "Sneak Attack", explanation: "Apply on a qualifying hit." }
        ],
        assumptions: ["Target is visible."],
        rejectedAlternatives: [{ optionId: "basic_dodge", name: "Dodge", reason: "Less pressure." }],
        followUpQuestions: ["Is Sneak Attack eligible?"],
        whyNotHigher: "",
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
  assert.deepEqual(merged[0].recommendation.pieces.map((piece) => piece.name), ["Rapier", "Sneak Attack"]);
  assert.equal(merged[0].recommendation.goalFit, "Best damage plan.");
  assert.equal(merged[0].recommendation.expectedOutcome, "Reliable hit plus rider.");
  assert.equal(merged[0].recommendation.rejectedAlternatives[0].name, "Dodge");
  assert.deepEqual(merged[0].recommendation.followUpQuestions, ["Is Sneak Attack eligible?"]);
  assert.match(merged[0].recommendation.warnings.join(" "), /enemy AC/);
  assert.equal(merged[1].id, "basic_dodge");
});

test("AI table adapter uses the first concrete plan piece as the primary row", () => {
  const attack = option("attack_rapier", "Rapier");
  const merged = recommendationTableOptions(
    [{ option: attack }],
    {
      recommendations: [{
        rank: 1,
        score: 88,
        summary: "No useful bonus action, then attack.",
        pieces: [
          { slot: "Bonus Action", optionId: "", name: "None", explanation: "No useful bonus action." },
          { slot: "Action", optionId: "attack_rapier", name: "Rapier", explanation: "Attack the target." }
        ],
        warnings: []
      }]
    },
    { attacks: [attack] }
  );

  assert.equal(merged[0].id, "attack_rapier");
  assert.equal(merged[0].recommendation.explanation, "Attack the target.");
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

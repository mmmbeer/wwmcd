import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRecommendationUserMessage,
  compactContextForRequest,
  extractFirstJsonObject,
  getAiRecommendations,
  isStructuredOutputUnsupportedError,
  normalizeAiResponse,
  shouldAskClarifyingQuestion
} from "../js/player-combat/ai/aiRecommendationService.js";

const availableRapier = {
  id: "attack_rapier",
  name: "Rapier",
  cost: { action: true },
  available: true
};

const availableSneakAttack = {
  id: "feature_sneak_attack",
  name: "Sneak Attack",
  available: true,
  tags: ["rider"],
  resource: { name: "Sneak Attack" }
};

const unavailableFireball = {
  id: "spell_fireball",
  name: "Fireball",
  cost: { action: true },
  available: false,
  unavailableReasons: ["No level 3 spell slots remain."]
};

test("AI recommendation service falls back when json_schema response format is unsupported", async () => {
  const calls = [];
  const recommendations = await getAiRecommendations({
    apiKey: "test-key",
    model: "fallback-model",
    context: {
      availableOptions: { attacks: [availableRapier] },
      unavailableOptions: { spells: [unavailableFireball] },
      optionIndex: [{ id: "attack_rapier", name: "Rapier" }]
    },
    chatClient: async (request) => {
      calls.push(request);
      if (calls.length === 1) {
        throw new Error("This model does not support response format `json_schema`.");
      }
      return { text: JSON.stringify(responseWithAction("attack_rapier", "Rapier")) };
    }
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].responseFormat.type, "json_schema");
  assert.ok(JSON.stringify(calls[0].responseFormat).includes("planPieces"));
  assert.equal(calls[0].temperature, 0.15);
  assert.equal(calls[1].responseFormat, undefined);
  assert.match(calls[1].messages[0].content, /Return ONLY valid JSON/);
  assert.match(calls[1].messages[1].content, /ranked complete turn plans/);
  assert.match(calls[1].messages[1].content, /planPieces/);
  assert.equal(recommendations.recommendations[0].pieces[0].optionId, "attack_rapier");
  assert.equal(recommendations.sets, recommendations.recommendations);
});

test("normalization preserves full turn plan pieces for extra attacks and class riders", () => {
  const payload = responseWithAction("attack_rapier", "Rapier");
  payload.recommendations[0].planPieces = [
    {
      slot: "Attack 1",
      optionId: "attack_rapier",
      name: "Rapier",
      explanation: "First Extra Attack swing."
    },
    {
      slot: "Attack 2",
      optionId: "attack_rapier",
      name: "Rapier",
      explanation: "Second Extra Attack swing."
    },
    {
      slot: "Rider",
      optionId: "feature_sneak_attack",
      name: "Sneak Attack",
      explanation: "Apply only if the attack qualifies."
    }
  ];

  const result = normalizeAiResponse(JSON.stringify(payload), {
    availableOptions: { attacks: [availableRapier], resources: [availableSneakAttack] },
    unavailableOptions: {}
  });

  assert.deepEqual(result.recommendations[0].pieces.map((piece) => piece.slot), ["Attack 1", "Attack 2", "Rider"]);
  assert.equal(result.recommendations[0].pieces[2].optionId, "feature_sneak_attack");
  assert.equal(result.recommendations[0].action.slot, "Attack 1");
});

test("normalization flags invented option IDs without dropping the recommendation", () => {
  const result = normalizeAiResponse(JSON.stringify(responseWithAction("made_up_action", "Meteor Slash")), {
    availableOptions: { attacks: [availableRapier] },
    unavailableOptions: {}
  });

  assert.equal(result.recommendations.length, 1);
  assert.equal(result.recommendations[0].legality, "conditional");
  assert.match(result.recommendations[0].warnings.join(" "), /No matching available option/);
  assert.equal(result.recommendations[0].pieces[0].option, null);
});

test("normalization flags unavailable matched options", () => {
  const result = normalizeAiResponse(JSON.stringify(responseWithAction("spell_fireball", "Fireball")), {
    availableOptions: { attacks: [availableRapier] },
    unavailableOptions: { spells: [unavailableFireball] }
  });

  assert.equal(result.recommendations[0].pieces[0].optionId, "spell_fireball");
  assert.equal(result.recommendations[0].legality, "conditional");
  assert.match(result.recommendations[0].warnings.join(" "), /marked unavailable/);
});

test("normalization defaults null concentration impact to none", () => {
  const payload = responseWithAction("attack_rapier", "Rapier");
  payload.recommendations[0].concentrationImpact = null;
  const result = normalizeAiResponse(JSON.stringify(payload), {
    availableOptions: { attacks: [availableRapier] }
  });

  assert.equal(result.recommendations[0].concentrationImpact, "none");
});

test("balanced JSON extraction ignores surrounding text and braces in strings", () => {
  const wrapped = `notes before JSON ${JSON.stringify({
    turnAssessment: "Use {braces} safely.",
    recommendedOptionId: "attack_rapier",
    missingInfo: [],
    recommendations: [recommendation("attack_rapier", "Rapier")]
  })} trailing {"second":true}`;
  const extracted = extractFirstJsonObject(wrapped);

  assert.equal(JSON.parse(extracted).turnAssessment, "Use {braces} safely.");
  assert.equal(normalizeAiResponse(wrapped, { availableOptions: { attacks: [availableRapier] } }).recommendations[0].legality, "legal");
});

test("clarification helper detects all-conditional results with several missing facts", () => {
  assert.equal(shouldAskClarifyingQuestion({
    missingInfo: ["range", "line of sight", "enemy AC"],
    recommendations: [{ legality: "conditional" }, { legality: "risky" }]
  }), true);
  assert.equal(shouldAskClarifyingQuestion({
    missingInfo: ["range", "line of sight", "enemy AC"],
    recommendations: [{ legality: "legal" }]
  }), false);
});

test("structured output unsupported detector matches Groq response format errors", () => {
  assert.equal(isStructuredOutputUnsupportedError(new Error("This model does not support response format `json_schema`.")), true);
  assert.equal(isStructuredOutputUnsupportedError(new Error("Network failed.")), false);
});

test("user message builder includes shared tactical instructions and context JSON", () => {
  const message = buildRecommendationUserMessage({ schemaVersion: "combat-turn-recommendation/v2" });
  assert.match(message, /complete turn plans/);
  assert.match(message, /optionIndex/);
  assert.match(message, /classTactics/);
  assert.match(message, /combat-turn-recommendation\/v2/);
});

test("user message builder compacts oversized tactical context", () => {
  const context = largeContext();
  const compact = compactContextForRequest(context, 12000);
  const message = buildRecommendationUserMessage(context);

  assert.equal(compact.requestNotes.contextCompacted, true);
  assert.equal(compact.classTactics.rogue.priorities[0], "Prioritize Sneak Attack.");
  assert.ok(JSON.stringify(compact).length < JSON.stringify(context).length);
  assert.ok(compact.availableOptions.spells.length < context.availableOptions.spells.length);
  assert.match(message, /contextCompacted/);
  assert.ok(message.length < JSON.stringify(context).length);
});

function responseWithAction(optionId, name) {
  return {
    turnAssessment: "Attack is the clearest plan.",
    recommendedOptionId: optionId,
    missingInfo: [],
    recommendations: [recommendation(optionId, name)]
  };
}

function largeContext() {
  const longText = "Long tactical and rules text. ".repeat(200);
  const options = Array.from({ length: 80 }, (_, index) => ({
    id: `spell_${index}`,
    name: `Spell ${index}`,
    source: "spell",
    group: "spells",
    available: true,
    cost: { action: true },
    rolls: [{ id: "damage", formula: "8d6" }],
    tags: ["spell"],
    spell: { level: 3, concentration: index % 2 === 0 },
    summary: longText
  }));
  return {
    schemaVersion: "combat-turn-recommendation/v2",
    character: {
      name: "Large",
      spells: {
        prepared: options.map((option) => ({ name: option.name, level: 3, description: longText })),
        known: options.map((option) => ({ name: option.name, level: 3, description: longText }))
      },
      features: { class: options.map((option) => ({ name: option.name, description: longText })) },
      equipment: { items: options.map((option) => ({ name: option.name, description: longText })) }
    },
    combatState: { current: { concentration: null }, turn: {} },
    turnRules: {},
    playerIntent: {},
    classTactics: {
      rogue: {
        priorities: ["Prioritize Sneak Attack."],
        checks: ["Check advantage."],
        resourceGuidance: [],
        avoid: [],
        reminderQuestions: ["Does the rogue have advantage?"]
      }
    },
    availableOptions: { spells: options },
    unavailableOptions: { spells: options.map((option) => ({ ...option, available: false })) },
    optionIndex: options.map((option) => ({ id: option.id, name: option.name, group: "spells" })),
    deterministicRecommendations: [],
    instructionHints: {}
  };
}

function recommendation(optionId, name) {
  return {
    id: "rec-1",
    rank: 1,
    category: "best_overall",
    title: `Use ${name}`,
    score: 90,
    confidence: "high",
    legality: "legal",
    riskLevel: "low",
    explanation: "Best available turn plan.",
    expectedOutcome: "Deal reliable damage.",
    movement: "Stay in range.",
    planPieces: [
      {
        slot: "Action",
        optionId,
        name,
        explanation: "Uses the main action."
      }
    ],
    action: {
      slot: "Action",
      optionId,
      name,
      explanation: "Uses the main action."
    },
    bonusAction: {
      slot: "Bonus Action",
      optionId: "",
      name: "None",
      explanation: "No useful bonus action available."
    },
    freeInteraction: "None.",
    reactionPlan: "Use a reaction only if a legal trigger occurs.",
    resourcesUsed: [],
    concentrationImpact: "none",
    assumptions: [],
    reasons: ["Reliable option"],
    warnings: []
  };
}

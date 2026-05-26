import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRecommendationUserMessage,
  compactContextForRequest,
  extractFirstJsonObject,
  getAiRecommendations,
  isStructuredOutputUnsupportedError,
  normalizeAiResponse,
  shouldUseJsonSchema,
  shouldAskClarifyingQuestion
} from "../js/player-combat/ai/aiRecommendationService.js";
import { recommendationResponseFormat } from "../js/player-combat/ai/aiRecommendationResponseContract.js";

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
    provider: "openai",
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
  assert.ok(JSON.stringify(calls[0].responseFormat).includes("optionId"));
  assert.ok(JSON.stringify(calls[0].responseFormat).includes("optionAudit"));
  assert.equal(JSON.stringify(calls[0].responseFormat).includes("planPieces"), true);
  assert.equal(JSON.stringify(calls[0].responseFormat).includes("\"action\""), false);
  assert.equal(JSON.stringify(calls[0].responseFormat).includes("\"bonusAction\""), false);
  assert.equal(calls[0].temperature, 0.15);
  assert.equal(calls[1].responseFormat.type, "json_object");
  assert.match(calls[1].messages[0].content, /Return ONLY valid JSON/);
  assert.match(calls[1].messages[1].content, /ranked list of complete turn plans/);
  assert.match(calls[1].messages[1].content, /optionAudit/);
  assert.match(calls[1].messages[1].content, /optionIndex/);
  assert.equal(recommendations.recommendations[0].pieces[0].optionId, "attack_rapier");
  assert.equal(recommendations.sets, recommendations.recommendations);
});

test("AI recommendation service uses one JSON object request for Groq", async () => {
  const calls = [];
  const recommendations = await getAiRecommendations({
    apiKey: "test-key",
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    context: {
      availableOptions: { attacks: [availableRapier] },
      unavailableOptions: {},
      optionIndex: [{ id: "attack_rapier", name: "Rapier" }]
    },
    chatClient: async (request) => {
      calls.push(request);
      return { text: JSON.stringify(responseWithAction("attack_rapier", "Rapier")) };
    }
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].responseFormat.type, "json_object");
  assert.equal(JSON.stringify(calls[0].responseFormat).includes("json_schema"), false);
  assert.match(calls[0].messages[0].content, /Return ONLY valid JSON/);
  assert.equal(recommendations.recommendations[0].pieces[0].optionId, "attack_rapier");
});

test("normalization preserves combo turn plan pieces", () => {
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
  assert.equal(result.recommendations[0].pieces[0].optionId, "attack_rapier");
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

test("strict optionIndex validation rejects missing and mismatched plan pieces", () => {
  const payload = responseWithAction("spell_eldritch_blast", "Eldritch Blast");
  payload.recommendations[0].planPieces = [
    { slot: "Action", optionId: "spell_eldritch_blast", name: "Eldritch Blast", explanation: "Cast Eldritch Blast." },
    { slot: "Action", optionId: "attack_unarmed_strike", name: "Eldritch Blast", explanation: "Use Eldritch Blast beams." },
    { slot: "Bonus Action", name: "None", explanation: "No useful bonus action." }
  ];

  const result = normalizeAiResponse(JSON.stringify(payload), yetiContext());

  assert.equal(result.recommendations.length, 0);
});

test("strict validation rejects explanations that describe a different indexed option", () => {
  const payload = responseWithAction("attack_unarmed_strike", "Unarmed Strike");
  payload.recommendations[0].planPieces[0].explanation = "Cast Eldritch Blast from range.";
  const result = normalizeAiResponse(JSON.stringify(payload), {
    ...yetiContext(),
    optionIndex: [
      ...yetiContext().optionIndex,
      { id: "spell_eldritch_blast", name: "Eldritch Blast" }
    ]
  });

  assert.equal(result.recommendations.length, 0);
});

test("strict validation flags misleading resource and Hex concentration claims", () => {
  const payload = responseWithAction("spell_guiding_bolt", "Guiding Bolt");
  payload.recommendations[0].resourcesUsed = ["Level 1 spell slot"];
  payload.recommendations[0].reasons = ["No resource cost"];
  payload.recommendations[0].planPieces = [
    { slot: "Action", optionId: "spell_guiding_bolt", name: "Guiding Bolt", explanation: "Spend a spell slot for radiant damage." },
    { slot: "Bonus Action", optionId: "spell_hex", name: "Hex", explanation: "Cast Hex first." }
  ];
  const result = normalizeAiResponse(JSON.stringify(payload), yetiContext());

  assert.equal(result.recommendations[0].legality, "conditional");
  assert.match(result.recommendations[0].warnings.join(" "), /claims no resource cost/);
  assert.match(result.recommendations[0].warnings.join(" "), /already concentrating on Hex/);
});

test("Yeti prompt preserves concrete distance and terrain hazard constraints", () => {
  const message = buildRecommendationUserMessage(yetiContext());

  assert.match(message, /15 ft away/);
  assert.match(message, /rock cover nearby across a ravine/);
  assert.match(message, /safe path/);
  assert.match(message, /Every optionId and name must match/);
});

test("normalization tolerates malformed recommendation objects", () => {
  const result = normalizeAiResponse(JSON.stringify({
    turnAssessment: "Malformed item.",
    recommendedOptionId: "",
    missingInfo: [],
    recommendations: [null]
  }), {
    availableOptions: { attacks: [availableRapier] },
    unavailableOptions: {}
  });

  assert.equal(result.recommendations.length, 1);
  assert.equal(result.recommendations[0].title, "AI turn plan 1");
  assert.equal(result.recommendations[0].action.name, "None");
});

test("normalization warns when matching by name only because optionId is missing", () => {
  const payload = responseWithAction("", "Rapier");
  const result = normalizeAiResponse(JSON.stringify(payload), {
    availableOptions: { attacks: [availableRapier] },
    unavailableOptions: {}
  });

  assert.equal(result.recommendations[0].pieces[0].optionId, "attack_rapier");
  assert.match(result.recommendations[0].warnings.join(" "), /by name only because optionId was missing/);
});

test("normalization treats duplicate option names as unmatched without an optionId", () => {
  const payload = responseWithAction("", "Strike");
  const result = normalizeAiResponse(JSON.stringify(payload), {
    availableOptions: {
      attacks: [
        { id: "attack_strike_1", name: "Strike", available: true },
        { id: "attack_strike_2", name: "Strike", available: true }
      ]
    },
    unavailableOptions: {}
  });

  assert.equal(result.recommendations[0].pieces[0].option, null);
  assert.match(result.recommendations[0].warnings.join(" "), /Multiple available options are named "Strike"/);
});

test("normalization validates complete turn plan action economy", () => {
  const payload = responseWithAction("attack_rapier", "Rapier");
  payload.recommendations[0].planPieces = [
    { slot: "Attack 1", optionId: "attack_rapier", name: "Rapier", explanation: "First swing." },
    { slot: "Attack 2", optionId: "attack_rapier", name: "Rapier", explanation: "Second swing." }
  ];
  const extraAttacks = normalizeAiResponse(JSON.stringify(payload), {
    availableOptions: { attacks: [availableRapier] }
  });
  assert.doesNotMatch(extraAttacks.recommendations[0].warnings.join(" "), /more than one explicit Action/);
  assert.deepEqual(extraAttacks.recommendations[0].pieces.map((piece) => piece.slot), ["Attack 1", "Attack 2"]);

  payload.recommendations[0].planPieces = [
    { slot: "Action", optionId: "attack_rapier", name: "Rapier", explanation: "Main action." },
    { slot: "Action", optionId: "attack_rapier", name: "Rapier", explanation: "Second action." },
    { slot: "Bonus Action", optionId: "bonus_hide", name: "Hide", explanation: "Hide." },
    { slot: "Bonus Action", optionId: "bonus_dash", name: "Dash", explanation: "Dash." }
  ];
  const overBudget = normalizeAiResponse(JSON.stringify(payload), {
    availableOptions: {
      attacks: [availableRapier],
      bonus: [
        { id: "bonus_hide", name: "Hide", available: true },
        { id: "bonus_dash", name: "Dash", available: true }
      ]
    }
  });

  assert.match(overBudget.recommendations[0].warnings.join(" "), /more than one explicit Action/);
  assert.match(overBudget.recommendations[0].warnings.join(" "), /more than one Bonus Action/);
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

test("normalization downgrades recommendations using battlefield-avoided damage", () => {
  const fireBolt = {
    id: "spell_fire_bolt",
    name: "Fire Bolt",
    available: true,
    cost: { action: true },
    damageTypes: ["fire"],
    rolls: [{ id: "damage", type: "damage", formula: "2d10", damageType: "fire" }]
  };
  const result = normalizeAiResponse(JSON.stringify(responseWithAction("spell_fire_bolt", "Fire Bolt")), {
    battlefieldKnowledge: { avoidDamageTypes: ["fire"] },
    availableOptions: { spells: [fireBolt] },
    unavailableOptions: {}
  });

  assert.equal(result.recommendations[0].legality, "conditional");
  assert.match(result.recommendations[0].warnings.join(" "), /deals fire damage/);
});

test("normalization defaults null concentration impact to none", () => {
  const payload = responseWithAction("attack_rapier", "Rapier");
  payload.recommendations[0].concentrationImpact = null;
  const result = normalizeAiResponse(JSON.stringify(payload), {
    availableOptions: { attacks: [availableRapier] }
  });

  assert.equal(result.recommendations[0].concentrationImpact, "none");
});

test("normalization preserves tactical plan metadata fields", () => {
  const payload = responseWithAction("attack_rapier", "Rapier");
  payload.recommendations[0].goalFit = "Best damage plan without spending resources.";
  payload.recommendations[0].expectedOutcome = "Reliable weapon damage.";
  payload.recommendations[0].followUpQuestions = ["Is the target within melee reach?"];
  payload.recommendations[0].rejectedAlternatives = [
    { optionId: "spell_fireball", name: "Fireball", reason: "No slot available." }
  ];
  const result = normalizeAiResponse(JSON.stringify(payload), {
    availableOptions: { attacks: [availableRapier] },
    unavailableOptions: { spells: [unavailableFireball] }
  });

  assert.equal(result.recommendations[0].goalFit, "Best damage plan without spending resources.");
  assert.equal(result.recommendations[0].expectedOutcome, "Reliable weapon damage.");
  assert.deepEqual(result.recommendations[0].followUpQuestions, ["Is the target within melee reach?"]);
  assert.equal(result.recommendations[0].rejectedAlternatives[0].name, "Fireball");
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

test("balanced JSON extraction handles markdown fences", () => {
  const fenced = `\`\`\`json
${JSON.stringify(responseWithAction("attack_rapier", "Rapier"))}
\`\`\``;
  const result = normalizeAiResponse(fenced, { availableOptions: { attacks: [availableRapier] } });

  assert.equal(result.recommendations[0].pieces[0].optionId, "attack_rapier");
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

test("response schema uses strict slot enum and aligned optionAudit fields", () => {
  const schema = recommendationResponseFormat().json_schema.schema;
  const pieceSlot = schema.properties.recommendations.items.properties.planPieces.items.properties.slot;
  const audit = schema.properties.optionAudit;

  assert.deepEqual(pieceSlot.enum, [
    "Action",
    "Attack 1",
    "Attack 2",
    "Bonus Action",
    "Rider",
    "Special",
    "Movement",
    "Free/Object Interaction",
    "Reaction",
    "None"
  ]);
  assert.deepEqual(audit.required, [
    "dataWarnings",
    "modelRelevantWarnings",
    "ignoredDeterministicRecommendations",
    "candidateDowngrades",
    "highValueTacticalHooks"
  ]);
  assert.ok(audit.properties.modelRelevantWarnings);
  assert.ok(audit.properties.candidateDowngrades);
});

test("strict response validation rejects arbitrary plan piece slot strings", () => {
  const payload = responseWithAction("spell_guiding_bolt", "Guiding Bolt");
  payload.recommendations[0].planPieces = [
    { slot: "Move", optionId: "spell_guiding_bolt", name: "Guiding Bolt", explanation: "Cast Guiding Bolt." }
  ];
  payload.recommendations[0].resourcesUsed = ["Level 1 spell slot"];

  const result = normalizeAiResponse(JSON.stringify(payload), yetiContext());

  assert.equal(result.recommendations.length, 0);
});

test("schema request selection avoids providers and models likely to reject json_schema", () => {
  assert.equal(shouldUseJsonSchema({ provider: "groq", model: "llama-3.3-70b-versatile" }), false);
  assert.equal(shouldUseJsonSchema({ provider: "openai", model: "gpt-4.1-mini" }), true);
  assert.equal(shouldUseJsonSchema({ provider: "openai", model: "llama-compatible" }), false);
});

test("user message builder includes shared tactical instructions and context JSON", () => {
  const message = buildRecommendationUserMessage({ schemaVersion: "combat-option-recommendation/v3" });
  assert.match(message, /complete turn plans/);
  assert.match(message, /whole turn/);
  assert.match(message, /Hex or Hunter's Mark/);
  assert.match(message, /selectedCreatures/);
  assert.match(message, /optionIndex/);
  assert.match(message, /optionAudit/);
  assert.match(message, /classTactics/);
  assert.match(message, /combat-option-recommendation\/v3/);
});

test("user message builder compacts oversized tactical context", () => {
  const context = largeContext();
  const compact = compactContextForRequest(context, 12000);
  const message = buildRecommendationUserMessage(context);

  assert.equal(compact.requestNotes.contextCompacted, true);
  assert.equal(compact.classTactics.rogue.priorities[0], "Prioritize Sneak Attack.");
  assert.equal(compact.rankingGuidance.highPriorityOptions[0].id, "spell_hex");
  assert.equal(compact.selectedCreatures[0].ac[0], 19);
  assert.ok(JSON.stringify(compact).length < JSON.stringify(context).length);
  assert.ok(compact.availableOptions.spells.length < context.availableOptions.spells.length);
  assert.equal(typeof compact.availableOptions.spells[0], "string");
  assert.equal(compact.optionIndex.some((option) => option.id === compact.availableOptions.spells[0]), true);
  assert.match(message, /contextCompacted/);
  assert.ok(message.length < JSON.stringify(context).length);
});

test("compact context rebuilds option index from compacted available options", () => {
  const option = (id, name, group) => ({
    id,
    name,
    group,
    available: true,
    cost: group === "bonus" ? { bonusAction: true } : { action: true },
    summary: "Useful option. ".repeat(80)
  });
  const context = {
    ...largeContext(),
    availableOptions: {
      spells: [option("spell_bless", "Bless", "spells")],
      bonus: [option("bonus_hide", "Hide", "bonus")],
      reaction: [option("reaction_shield", "Shield", "reaction")],
      resources: [option("resource_smite", "Divine Smite", "resources")]
    },
    optionIndex: Array.from({ length: 100 }, (_, index) => ({
      id: `stale_${index}`,
      name: `Stale ${index}`,
      group: "stale"
    }))
  };

  const compact = compactContextForRequest(context, 9000);
  const compactIds = compact.optionIndex.map((entry) => entry.id);

  assert.equal(compact.requestNotes.contextCompacted, true);
  assert.deepEqual(compactIds.sort(), ["bonus_hide", "reaction_shield", "resource_smite", "spell_bless"].sort());
  assert.equal(compactIds.some((id) => id.startsWith("stale_")), false);
});

test("compact context removes deterministic candidates with optionIds missing from compact optionIndex", () => {
  const context = {
    schemaVersion: "combat-option-recommendation/v3",
    character: { name: "Eustace" },
    combatState: { current: { concentration: "Hex" } },
    playerIntent: { range: "unknown", userNotes: "I am 15ft from an adult white dragon." },
    availableOptions: {
      spells: [{ id: "spell_guiding_bolt", name: "Guiding Bolt", available: true, cost: { action: true } }],
      attacks: [{ id: "attack_unarmed_strike", name: "Unarmed Strike", available: true, cost: { action: true } }]
    },
    optionIndex: [
      { id: "spell_guiding_bolt", name: "Guiding Bolt" },
      { id: "attack_unarmed_strike", name: "Unarmed Strike" }
    ],
    optionAudit: {
      ignoredDeterministicRecommendations: [],
      highValueTacticalHooks: [
        "Hex plus Eldritch Blast is high value against a durable single target when concentration and range are legal.",
        "User notes include a concrete distance; use it for range legality."
      ]
    },
    deterministicRecommendations: [
      { title: "Damage turn: Guiding Bolt", optionIds: ["spell_guiding_bolt"] },
      { title: "Damage turn: Fire Bolt", optionIds: ["spell_fire_bolt", "spell_hex", "movement_walk"] }
    ]
  };

  const compact = compactContextForRequest(context, 700);

  assert.deepEqual(compact.deterministicRecommendations.map((set) => set.title), ["Damage turn: Guiding Bolt"]);
  assert.ok(compact.optionAudit.ignoredDeterministicRecommendations.some((warning) => /spell_fire_bolt is missing from optionIndex/i.test(warning)));
  assert.equal(compact.optionAudit.highValueTacticalHooks.some((hook) => /Eldritch Blast/i.test(hook)), false);
});

test("request context removes invalid deterministic candidates even without compaction", () => {
  const context = {
    optionIndex: [{ id: "spell_guiding_bolt", name: "Guiding Bolt" }],
    optionAudit: { highValueTacticalHooks: ["Hex plus Eldritch Blast is high value against a durable single target when concentration and range are legal."] },
    deterministicRecommendations: [
      { title: "Damage turn: Fire Bolt", optionIds: ["spell_fire_bolt"] },
      { title: "Damage turn: Guiding Bolt", optionIds: ["spell_guiding_bolt"] }
    ]
  };

  const requestContext = compactContextForRequest(context, 10000);

  assert.deepEqual(requestContext.deterministicRecommendations.map((set) => set.title), ["Damage turn: Guiding Bolt"]);
  assert.ok(requestContext.optionAudit.ignoredDeterministicRecommendations.some((warning) => /spell_fire_bolt is missing from optionIndex/i.test(warning)));
  assert.equal((requestContext.optionAudit.highValueTacticalHooks ?? []).some((hook) => /Eldritch Blast/i.test(hook)), false);
});

test("request compaction preserves candidate package and clarification prompts", () => {
  const context = {
    ...largeContext(),
    clarification: {
      prompts: [{ id: "distance", question: "Enemy distance or range band" }],
      canSkip: true
    },
    candidatePackage: {
      goal: "damage",
      completeTurnSlots: ["action", "bonusAction"],
      piecesBySlot: {
        action: [{ optionId: "spell_0", name: "Spell 0", slot: "Action", tacticalCategories: ["damage"] }]
      },
      allGoalRelevantSpells: [{ optionId: "spell_0", name: "Spell 0", slot: "Action", tacticalCategories: ["damage"] }]
    }
  };

  const compact = compactContextForRequest(context, 9000);

  assert.equal(compact.clarification.prompts[0].id, "distance");
  assert.equal(compact.candidatePackage.piecesBySlot.action[0].optionId, "spell_0");
  assert.equal(compact.candidatePackage.allGoalRelevantSpells[0].name, "Spell 0");
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
    selectedCreatures: [{
      name: "Adult Red Dragon",
      ac: [19],
      hp: { average: 256 },
      cr: "17",
      stats: { str: 27, dex: 10, con: 25, int: 16, wis: 13, cha: 21 },
      immunities: ["fire"],
      actions: [{ name: "Bite", summary: "Melee attack." }]
    }],
    rankingGuidance: {
      highPriorityOptions: [{ id: "spell_hex", name: "Hex", reason: "Use before repeated attacks." }],
      avoidOptions: [{ id: "spell_fire_bolt", name: "Fire Bolt", damageTypes: ["fire"] }],
      fullTurnPlanning: "Consider action, bonus action, movement, free interaction, and reaction reminder.",
      rangeTactics: "Prefer ranged plans when range supports them."
    },
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

function yetiContext() {
  const guidingBolt = {
    id: "spell_guiding_bolt",
    name: "Guiding Bolt",
    available: true,
    cost: { action: true, resource: { type: "spellSlot", level: 1 } },
    resource: "Level 1 spell slot",
    range: { type: "ranged", label: "120 ft", normal: 120 },
    rolls: [{ id: "damage", type: "damage", formula: "4d6", damageType: "radiant" }],
    spell: { level: 1, range: "120 ft" }
  };
  const hex = {
    id: "spell_hex",
    name: "Hex",
    available: true,
    cost: { bonus: true, resource: { type: "spellSlot", level: 1 } },
    resource: "Level 1 spell slot",
    spell: { level: 1, concentration: true, castingCost: "bonus", range: "90 ft" }
  };
  const unarmed = {
    id: "attack_unarmed_strike",
    name: "Unarmed Strike",
    available: true,
    cost: { action: true },
    rolls: [],
    range: { type: "melee", label: "5 ft", normal: 5 }
  };
  return {
    combatState: { concentration: "Hex", current: { concentration: "Hex" } },
    playerIntent: {
      range: "unknown",
      userNotes: "Abominable Yeti is 15 ft away. There is rock cover nearby across a ravine."
    },
    optionAudit: {
      dataWarnings: [],
      ignoredDeterministicRecommendations: ["Removed missing Eldritch Blast candidate."],
      highValueTacticalHooks: ["Movement to rock cover is conditional on a safe path."]
    },
    availableOptions: {
      attacks: [unarmed],
      spells: [guidingBolt, hex],
      movement: [{ id: "movement_walk", name: "Move", available: true, cost: { movement: true } }]
    },
    unavailableOptions: {},
    optionIndex: [
      { id: "attack_unarmed_strike", name: "Unarmed Strike" },
      { id: "spell_guiding_bolt", name: "Guiding Bolt" },
      { id: "spell_hex", name: "Hex" },
      { id: "movement_walk", name: "Move" }
    ]
  };
}

function recommendation(optionId, name) {
  return {
    id: "rec-1",
    rank: 1,
    category: "best_overall",
    goalFit: "Fits the selected goal.",
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
    rejectedAlternatives: [],
    whyNotHigher: "",
    followUpQuestions: [],
    warnings: []
  };
}

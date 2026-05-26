import assert from "node:assert/strict";
import test from "node:test";
import { buildAiRecommendationContext } from "../js/player-combat/ai/aiRecommendationContext.js";
import { validateSeedPlans } from "../js/player-combat/ai/aiSeedPlanBuilder.js";

test("AI recommendation context includes versioned tactical context", () => {
  const option = {
    id: "attack_rapier",
    name: "Rapier",
    source: "weapon",
    group: "attacks",
    available: true,
    cost: { action: true },
    attack: { count: 2 },
    rolls: [{ id: "attack", type: "attack", formula: "1d20+7" }],
    description: "Make a melee weapon attack."
  };
  const context = buildAiRecommendationContext({
    snapshot: {
      activeCharacter: {
        name: "Mara",
        level: 5,
        race: { name: "Elf", features: [{ name: "Darkvision" }] },
        classes: [{ name: "Fighter", level: 5 }, { name: "Rogue", level: 1 }],
        stats: { str: 10, dex: 18, con: 14, int: 10, wis: 12, cha: 8 },
        combat: { maxHp: 44, ac: 16, speed: { walk: 30 } },
        resources: {
          spellSlots: { 1: 2 },
          classResources: [{ id: "resource-action-surge", name: "Action Surge", max: 1 }],
          limitedUses: []
        },
        features: { class: [{ name: "Extra Attack" }], race: [], feats: [], other: [] },
        inventory: { weapons: [{ name: "Rapier", damage: "1d8" }], armor: [], consumables: [], magicItems: [], other: [] },
        spells: { spellcastingAbility: "int", attackBonus: 7, saveDc: 15, cantrips: [], prepared: [{ name: "Shield", level: 1 }], known: [] }
      },
      combatState: {
        round: 2,
        current: { hp: 30, tempHp: 0, ac: 16, conditions: ["Prone"], concentration: null, activeEffects: [] },
        turn: { actionUsed: false, bonusActionUsed: false, reactionUsed: true, movementUsed: 10 },
        resourcesUsed: { spellSlots: { 1: 1 }, classResources: {}, itemCharges: {} },
        lastRoll: null
      }
    },
    groups: {
      attacks: [option],
      spells: [{
        id: "spell_fireball",
        name: "Fireball",
        source: "spell",
        group: "spells",
        available: false,
        unavailableReasons: ["No level 3 spell slots remain."],
        description: "A bright streak flashes from your pointing finger.",
        spell: { level: 3, concentration: false }
      }]
    },
    recommendationSets: [{
      rank: 1,
      title: "Damage turn: Rapier",
      score: 120,
      pieces: [{ slot: "Attack 1", entry: { option, reasons: ["High damage"], warnings: [] } }],
      reasons: ["High damage"],
      warnings: []
    }],
    answers: {
      goal: "damage",
      situation: "single",
      distance: "melee",
      difficulty: "hard",
      resources: "normal",
      rollMode: "advantage",
      concentration: "allow"
    },
    userNotes: "Enemy is nearly defeated."
  });

  assert.equal(context.character.name, "Mara");
  assert.equal(context.schemaVersion, "combat-option-recommendation/v3");
  assert.equal(context.combatState.hp.current, 30);
  assert.equal(context.playerIntent.userNotes, "Enemy is nearly defeated.");
  assert.equal(context.wizard, undefined);
  assert.equal(context.turnRules.actionEconomy.maxActions, 1);
  assert.equal(context.instructionHints.preferCompleteTurnPlans, true);
  assert.equal(Boolean(context.classTactics.fighter), true);
  assert.equal(Boolean(context.classTactics.rogue), true);
  assert.equal(context.classTactics.wizard, undefined);
  assert.equal(context.classTactics.rogue.reminderQuestions.includes("Does the rogue have advantage?"), true);
  assert.equal(context.availableOptions.attacks[0].attack.count, 2);
  assert.equal(context.availableOptions.spells, undefined);
  assert.equal(context.unavailableOptions.spells[0].id, "spell_fireball");
  assert.equal(context.optionIndex.some((option) => option.id === "attack_rapier"), true);
  assert.equal(context.optionIndex.some((option) => option.id === "spell_fireball"), false);
  assert.equal(context.candidatePackage.piecesBySlot.action.some((piece) => piece.optionId === "attack_rapier"), true);
  assert.equal(context.clarification.prompts.some((prompt) => prompt.id === "lineOfSight"), true);
  assert.equal(context.deterministicRecommendations[0].pieces[0].option.id, "attack_rapier");
});

test("AI recommendation context prioritizes castable high-level spells and omits spent spell summaries", () => {
  const lowLevelSpells = Array.from({ length: 48 }, (_, index) => ({
    id: `spell_low_${index}`,
    name: `Low Spell ${index}`,
    source: "spell",
    group: "actions",
    available: true,
    cost: { action: true, resource: { type: "spellSlot", level: 1 } },
    spell: { level: 1, concentration: false, range: "60 feet" },
    description: "Deal 1d6 force damage."
  }));
  const highLevelSpell = {
    id: "spell_sunburst",
    name: "Sunburst",
    source: "spell",
    group: "actions",
    available: true,
    cost: { action: true, resource: { type: "spellSlot", level: 8 } },
    spell: { level: 8, concentration: false, range: "150 feet" },
    description: "Deal 12d6 radiant damage."
  };

  const context = buildAiRecommendationContext({
    snapshot: {
      activeCharacter: {
        name: "Ilyra",
        classes: [{ name: "Wizard", level: 17 }],
        race: {},
        combat: { maxHp: 80 },
        resources: { spellSlots: { 1: 4, 8: 1, 9: 1 } },
        features: {},
        inventory: {},
        spells: {
          prepared: [
            { name: "Magic Missile", level: 1 },
            { name: "Sunburst", level: 8 },
            { name: "Meteor Swarm", level: 9 }
          ],
          known: []
        }
      },
      combatState: {
        current: { hp: 34 },
        turn: {},
        resourcesUsed: { spellSlots: { 9: 1 } }
      }
    },
    groups: { actions: [...lowLevelSpells, highLevelSpell] },
    recommendationSets: [],
    answers: { goal: "damage" },
    userNotes: ""
  });

  assert.equal(context.availableOptions.actions.some((option) => option.id === "spell_sunburst"), true);
  assert.equal(context.candidatePackage.allGoalRelevantSpells.some((option) => option.optionId === "spell_sunburst"), true);
  assert.equal(context.character.spells.prepared.some((spell) => spell.name === "Sunburst"), true);
  assert.equal(context.character.spells.prepared.some((spell) => spell.name === "Meteor Swarm"), false);
});

test("AI recommendation context includes compact reference summaries for relevant options", () => {
  const context = buildAiRecommendationContext({
    snapshot: {
      activeCharacter: {
        name: "Ilyra",
        classes: [{ name: "Wizard", level: 5 }],
        race: { name: "Elf" },
        combat: {},
        resources: {},
        features: {},
        inventory: {},
        spells: {}
      },
      combatState: { current: {}, turn: {}, resourcesUsed: {} },
      referenceData: {
        data: {
          spells: { spell: [{ name: "Fireball", level: 3, school: "V", entries: ["A bright streak flashes and explodes."] }] },
          classes: { class: [{ name: "Wizard", entries: ["Arcane spellcaster."] }] },
          races: { race: [{ name: "Elf", entries: ["Keen senses."] }] }
        }
      }
    },
    groups: {
      spells: [{
        id: "spell_fireball",
        name: "Fireball",
        source: "spell",
        group: "spells",
        available: true,
        cost: { action: true },
        spell: { level: 3, concentration: false }
      }]
    },
    recommendationSets: [],
    answers: { goal: "damage" },
    userNotes: ""
  });

  assert.equal(context.referenceSummaries.spells[0].name, "Fireball");
  assert.equal(context.referenceSummaries.classes[0].name, "Wizard");
  assert.equal(context.referenceSummaries.races[0].name, "Elf");
});

test("AI recommendation context infers common creature lore from player notes", () => {
  const context = buildAiRecommendationContext({
    snapshot: {
      activeCharacter: {
        name: "Ilyra",
        classes: [{ name: "Wizard", level: 9 }],
        race: {},
        combat: { maxHp: 60 },
        resources: { spellSlots: { 3: 2 } },
        features: {},
        inventory: {},
        spells: {}
      },
      combatState: { current: { hp: 28 }, turn: {}, resourcesUsed: { spellSlots: {} } }
    },
    groups: {
      actions: [
        {
          id: "spell_fireball",
          name: "Fireball",
          source: "spell",
          group: "actions",
          available: true,
          cost: { action: true },
          description: "Each creature takes fire damage.",
          spell: { level: 3, concentration: false, range: "150 feet" }
        },
        {
          id: "spell_lightning_bolt",
          name: "Lightning Bolt",
          source: "spell",
          group: "actions",
          available: true,
          cost: { action: true },
          description: "Creatures in a line take lightning damage.",
          spell: { level: 3, concentration: false, range: "100 feet" }
        }
      ]
    },
    recommendationSets: [],
    answers: {},
    userNotes: "Fighting an adult red dragon."
  });

  assert.equal(context.battlefieldKnowledge.inferredCreatures[0].name, "red dragon");
  assert.deepEqual(context.battlefieldKnowledge.avoidDamageTypes, ["fire"]);
  assert.deepEqual(context.battlefieldKnowledge.impactedOptions, [{
    id: "spell_fireball",
    name: "Fireball",
    damageTypes: ["fire"]
  }]);
});

test("AI recommendation context exposes high-priority bonus setup and range guidance", () => {
  const context = buildAiRecommendationContext({
    snapshot: {
      activeCharacter: {
        name: "Eustace",
        classes: [{ name: "Warlock", level: 2 }],
        race: {},
        combat: { maxHp: 47, ac: 17 },
        resources: { spellSlots: { 1: 1 } },
        features: {},
        inventory: {},
        spells: {}
      },
      combatState: {
        current: { hp: 47, concentration: null },
        turn: {},
        resourcesUsed: { spellSlots: {} }
      }
    },
    groups: {
      attacks: [{
        id: "weapon_eldritch_blast",
        name: "Eldritch Blast",
        source: "weapon",
        group: "attacks",
        available: true,
        cost: { action: true },
        range: { type: "ranged", label: "120 ft", normal: 120 },
        rolls: [{ id: "damage", type: "damage", formula: "1d10", damageType: "force" }]
      }],
      bonus: [{
        id: "spell_hex",
        name: "Hex",
        source: "spell",
        group: "bonus",
        available: true,
        cost: { bonus: true, resource: { type: "spellSlot", level: 1 } },
        spell: { level: 1, castingCost: "bonus", concentration: true, range: "90 ft." }
      }]
    },
    recommendationSets: [],
    answers: { situation: "single", distance: "long" },
    userNotes: "Adult red dragon at 60 ft."
  });

  assert.equal(context.rankingGuidance.highPriorityOptions[0].id, "spell_hex");
  assert.match(context.rankingGuidance.fullTurnPlanning, /bonus action/);
  assert.match(context.rankingGuidance.rangeTactics, /range/);
});

test("AI recommendation context includes selected creature stats for hidden model guidance", () => {
  const context = buildAiRecommendationContext({
    snapshot: {
      activeCharacter: {
        name: "Eustace",
        classes: [{ name: "Warlock", level: 5 }],
        race: {},
        combat: { maxHp: 47, ac: 17 },
        resources: {},
        features: {},
        inventory: {},
        spells: {}
      },
      combatState: { current: { hp: 47 }, turn: {}, resourcesUsed: {} }
    },
    groups: {},
    recommendationSets: [],
    answers: {},
    userNotes: "",
    selectedCreatures: [{
      name: "Adult Red Dragon",
      source: "MM",
      ac: [19],
      hp: { average: 256, formula: "19d12 + 133" },
      cr: "17",
      str: 27,
      dex: 10,
      con: 25,
      int: 16,
      wis: 13,
      cha: 21,
      immune: ["fire"],
      action: [{ name: "Bite", entries: ["{@hit 14} to hit."] }]
    }]
  });

  assert.equal(context.selectedCreatures[0].name, "Adult Red Dragon");
  assert.deepEqual(context.selectedCreatures[0].ac, [19]);
  assert.equal(context.selectedCreatures[0].hp.average, 256);
  assert.deepEqual(context.selectedCreatures[0].immunities, ["fire"]);
  assert.equal(context.selectedCreatures[0].actions[0].name, "Bite");
});

test("AI recommendation context tolerates malformed deterministic recommendations", () => {
  const context = buildAiRecommendationContext({
    snapshot: {
      activeCharacter: {
        name: "Mara",
        classes: [],
        race: {},
        combat: {},
        resources: {},
        features: {},
        inventory: {},
        spells: {}
      },
      combatState: { current: {}, turn: {} }
    },
    groups: {
      actions: [{
        id: "action_dodge",
        name: "Dodge",
        available: true,
        rolls: "not-an-array",
        spell: "not-a-spell-object"
      }]
    },
    recommendationSets: [{
      title: null,
      score: "bad",
      pieces: [
        { slot: null, entry: { option: null, reasons: "bad", warnings: "bad" } },
        { option: "bad-option" }
      ],
      reasons: "bad",
      warnings: "bad"
    }],
    answers: {},
    userNotes: ""
  });

  assert.equal(context.availableOptions.actions[0].id, "action_dodge");
  assert.equal(context.availableOptions.actions[0].rolls.length, 0);
  assert.deepEqual(context.deterministicRecommendations ?? [], []);
  assert.ok(context.optionAudit.ignoredDeterministicRecommendations.some((warning) => /Removed deterministic recommendation/i.test(warning)));
});

test("AI recommendation context includes option audit diagnostics for malformed spell attacks and deterministic candidates", () => {
  const context = buildAiRecommendationContext({
    snapshot: {
      activeCharacter: {
        name: "Eustace",
        level: 5,
        classes: [{ name: "Warlock", level: 5 }],
        race: {},
        combat: { maxHp: 38, ac: 13 },
        resources: {},
        features: {},
        inventory: {},
        spells: { attackBonus: 7 }
      },
      combatState: { current: { hp: 12, concentration: null }, turn: {}, resourcesUsed: {} }
    },
    groups: {
      attacks: [{
        id: "weapon_fire_bolt",
        name: "Fire Bolt",
        source: "weapon",
        group: "attacks",
        available: true,
        cost: { action: true },
        range: { type: "melee", label: "5 ft", normal: 5 },
        rolls: [
          { id: "attack", type: "attack", formula: "1d20+3" },
          { id: "damage", type: "damage", formula: "2d10", damageType: "fire" }
        ],
        tags: ["attack", "weapon", "melee"]
      }],
      resources: [{
        id: "feature_harness_divine_power",
        name: "Harness Divine Power",
        source: "feature",
        available: true,
        cost: { bonus: true },
        rolls: []
      }],
      movement: [{ id: "movement_walk", name: "Move", source: "basic", group: "movement", available: true, cost: { movement: true }, rolls: [] }]
    },
    recommendationSets: [{
      rank: 1,
      title: "Damage turn: Fire Bolt",
      score: 100,
      pieces: [
        { slot: "Action", entry: { option: { id: "missing_fire_bolt", name: "Fire Bolt", rolls: [{ id: "damage", type: "damage", formula: "2d10" }] }, reasons: [], warnings: [] } },
        { slot: "Bonus", entry: { option: { id: "feature_harness_divine_power", name: "Harness Divine Power" }, reasons: [], warnings: [] } },
        { slot: "Move", entry: { option: { id: "movement_walk", name: "Move" }, reasons: [], warnings: [] } }
      ]
    }],
    answers: { goal: "damage", distance: "unknown" },
    userNotes: "Abominable Yeti 30 ft away near a ravine.",
    selectedCreatures: [{
      name: "Abominable Yeti",
      immune: ["cold"],
      action: [{ name: "Multiattack", entries: ["The yeti makes claw attacks and uses Chilling Gaze."] }]
    }]
  });

  assert.equal(context.optionIndex.some((option) => option.id === "weapon_fire_bolt"), false);
  assert.ok(context.optionAudit.dataWarnings.some((warning) => /missing optionId/i.test(warning)));
  assert.ok(context.optionAudit.ignoredDeterministicRecommendations.some((warning) => /Harness Divine Power/i.test(warning)));
  assert.ok(context.optionAudit.candidateDowngrades.some((warning) => /safe path/i.test(warning)));
  assert.ok(context.optionAudit.highValueTacticalHooks.some((hook) => /dangerous short-range pressure/i.test(hook)));
  assert.ok(context.optionAudit.highValueTacticalHooks.some((hook) => /cold damage/i.test(hook)));
});

test("AI recommendation context filters spell attacks that arrive as weapon options", () => {
  const context = buildAiRecommendationContext({
    snapshot: {
      activeCharacter: {
        name: "Eustace",
        level: 5,
        classes: [{ name: "Warlock", level: 2 }],
        race: {},
        combat: { maxHp: 47, ac: 17 },
        resources: {},
        features: {},
        inventory: {
          weapons: [
            { name: "Fire Bolt", damage: "2d10", damageType: "Fire" },
            { name: "Eldritch Blast", damage: "1d10", damageType: "Force" },
            { name: "Dagger", damage: "1d4", damageType: "piercing" }
          ]
        },
        spells: {
          cantrips: [{ name: "Fire Bolt", level: 0 }, { name: "Eldritch Blast", level: 0 }],
          known: [],
          prepared: []
        }
      },
      combatState: { current: {}, turn: {}, resourcesUsed: {} }
    },
    groups: {
      attacks: [
        { id: "weapon_fire_bolt", name: "Fire Bolt", source: "weapon", available: true, cost: { action: true }, rolls: [{ id: "damage", type: "damage", formula: "2d10", damageType: "fire" }] },
        { id: "weapon_eldritch_blast", name: "Eldritch Blast", source: "weapon", available: true, cost: { action: true }, rolls: [{ id: "damage", type: "damage", formula: "1d10", damageType: "force" }] },
        { id: "weapon_dagger", name: "Dagger", source: "weapon", available: true, cost: { action: true }, rolls: [{ id: "damage", type: "damage", formula: "1d4", damageType: "piercing" }] }
      ]
    },
    recommendationSets: [{
      title: "Damage turn: Fire Bolt",
      pieces: [{ slot: "Action", entry: { option: { id: "weapon_fire_bolt", name: "Fire Bolt" }, reasons: [], warnings: [] } }]
    }],
    answers: {},
    userNotes: ""
  });

  assert.equal(context.availableOptions.attacks.some((option) => option.id === "weapon_fire_bolt"), false);
  assert.equal(context.availableOptions.attacks.some((option) => option.id === "weapon_eldritch_blast"), false);
  assert.equal(context.availableOptions.attacks.some((option) => option.id === "weapon_dagger"), true);
  assert.equal(context.optionIndex.some((option) => option.id === "weapon_fire_bolt" || option.id === "weapon_eldritch_blast"), false);
  assert.equal(context.character.equipment.weapons.some((weapon) => weapon.name === "Fire Bolt" || weapon.name === "Eldritch Blast"), false);
  assert.ok(context.optionAudit.ignoredDeterministicRecommendations.some((warning) => /weapon_fire_bolt is missing from optionIndex/i.test(warning)));
});

test("Yeti context only includes hooks for indexed options and downgrades risky touch and movement plans", () => {
  const context = buildAiRecommendationContext({
    snapshot: {
      activeCharacter: {
        name: "Eustace",
        level: 5,
        classes: [{ name: "Cleric", level: 5 }],
        race: {},
        combat: { maxHp: 38, ac: 13 },
        resources: { spellSlots: { 1: 4 } },
        features: {},
        inventory: {},
        spells: { attackBonus: 7, saveDc: 15 }
      },
      combatState: { current: { hp: 12, concentration: "Hex" }, turn: {}, resourcesUsed: { spellSlots: {} } }
    },
    groups: {
      attacks: [{ id: "attack_unarmed_strike", name: "Unarmed Strike", source: "weapon", available: true, cost: { action: true }, rolls: [] }],
      spells: [
        { id: "spell_guiding_bolt", name: "Guiding Bolt", source: "spell", available: true, cost: { action: true, resource: { type: "spellSlot", level: 1 } }, resource: "Level 1 spell slot", range: { type: "ranged", label: "120 ft", normal: 120 }, rolls: [{ id: "damage", type: "damage", formula: "4d6", damageType: "radiant" }], spell: { level: 1, range: "120 ft" } },
        { id: "spell_inflict_wounds", name: "Inflict Wounds", source: "spell", available: true, cost: { action: true, resource: { type: "spellSlot", level: 1 } }, resource: "Level 1 spell slot", range: { type: "melee", label: "Touch", normal: 5 }, rolls: [{ id: "damage", type: "damage", formula: "3d10", damageType: "necrotic" }], spell: { level: 1, range: "Touch" } },
        { id: "spell_hex", name: "Hex", source: "spell", available: true, cost: { bonus: true, resource: { type: "spellSlot", level: 1 } }, resource: "Level 1 spell slot", range: { type: "ranged", label: "90 ft", normal: 90 }, rolls: [], spell: { level: 1, concentration: true, castingCost: "bonus", range: "90 ft" } }
      ],
      movement: [{ id: "movement_walk", name: "Move", source: "basic", group: "movement", available: true, cost: { movement: true }, rolls: [] }]
    },
    recommendationSets: [{
      title: "Bad deterministic blast",
      pieces: [{ slot: "Action", entry: { option: { id: "spell_eldritch_blast", name: "Eldritch Blast" }, reasons: [], warnings: [] } }]
    }],
    answers: { goal: "damage", distance: "unknown" },
    userNotes: "Abominable Yeti is 15 ft away. There is rock cover nearby across a ravine.",
    selectedCreatures: [{
      name: "Abominable Yeti",
      immune: ["cold"],
      action: [{ name: "Multiattack", entries: ["The yeti makes claw attacks and uses Chilling Gaze."] }]
    }]
  });

  assert.equal(context.optionIndex.some((option) => option.id === "spell_eldritch_blast"), false);
  assert.equal((context.deterministicRecommendations ?? []).length, 0);
  assert.equal(context.optionAudit.highValueTacticalHooks.some((hook) => /Eldritch Blast/i.test(hook)), false);
  assert.ok(context.optionAudit.ignoredDeterministicRecommendations.some((warning) => /spell_eldritch_blast/i.test(warning)));
  assert.ok(context.optionAudit.candidateDowngrades.some((warning) => /Inflict Wounds.*touch\/melee range/i.test(warning)));
  assert.ok(context.optionAudit.candidateDowngrades.some((warning) => /Move movement.*safe path/i.test(warning)));
  assert.ok(context.optionAudit.candidateDowngrades.some((warning) => /concrete distance/i.test(warning)));
});

test("deterministic seed plan validation rejects empty, missing, mismatched, and incompatible pieces", () => {
  const optionIndex = [
    { id: "spell_guiding_bolt", name: "Guiding Bolt", cost: { action: true, resource: { type: "spellSlot", level: 1 } }, resource: "Level 1 spell slot" },
    { id: "spell_shield", name: "Shield", cost: { reaction: true, resource: { type: "spellSlot", level: 1 } }, resource: "Level 1 spell slot" },
    { id: "spell_hex", name: "Hex", cost: { bonus: true, resource: { type: "spellSlot", level: 1 } }, resource: "Level 1 spell slot", concentration: true },
    { id: "basic_object_interaction", name: "Object Interaction", cost: { object: true } },
    { id: "movement_walk", name: "Move", cost: { movement: true } }
  ];
  const valid = {
    id: "valid",
    title: "Guiding Bolt",
    planPieces: [{ slot: "Action", optionId: "spell_guiding_bolt", name: "Guiding Bolt" }],
    resourcesUsed: ["Level 1 spell slot"]
  };
  const result = validateSeedPlans([
    {},
    { id: "missing", title: "Missing", planPieces: [{ slot: "Action", optionId: "spell_missing", name: "Missing" }] },
    { id: "available-only", title: "Available only", planPieces: [{ slot: "Action", optionId: "spell_fire_bolt", name: "Fire Bolt" }] },
    { id: "wrong-name", title: "Wrong name", planPieces: [{ slot: "Action", optionId: "spell_guiding_bolt", name: "Fire Bolt" }], resourcesUsed: ["Level 1 spell slot"] },
    { id: "object-bonus", title: "Object bonus", planPieces: [{ slot: "Bonus Action", optionId: "basic_object_interaction", name: "Object Interaction" }] },
    { id: "move-action", title: "Move action", planPieces: [{ slot: "Action", optionId: "movement_walk", name: "Move" }] },
    { id: "shield-action", title: "Shield action", planPieces: [{ slot: "Action", optionId: "spell_shield", name: "Shield" }], resourcesUsed: ["Level 1 spell slot"] },
    { id: "hex-action", title: "Hex action", planPieces: [{ slot: "Action", optionId: "spell_hex", name: "Hex" }], resourcesUsed: ["Level 1 spell slot"] },
    valid
  ], optionIndex);

  assert.deepEqual(result.plans.map((plan) => plan.id), ["valid"]);
  assert.ok(result.warnings.some((warning) => /empty or malformed/i.test(warning)));
  assert.ok(result.warnings.some((warning) => /spell_missing is missing from optionIndex/i.test(warning)));
  assert.ok(result.warnings.some((warning) => /spell_fire_bolt is missing from optionIndex/i.test(warning)));
  assert.ok(result.warnings.some((warning) => /named "Fire Bolt"/i.test(warning)));
  assert.ok(result.warnings.some((warning) => /basic_object_interaction is incompatible with Bonus Action/i.test(warning)));
  assert.ok(result.warnings.some((warning) => /movement_walk is incompatible with Action/i.test(warning)));
  assert.ok(result.warnings.some((warning) => /spell_shield is incompatible with Action/i.test(warning)));
  assert.ok(result.warnings.some((warning) => /spell_hex is incompatible with Action/i.test(warning)));
});

test("Archmage scenario builds valid complete deterministic seed plans from optionIndex", () => {
  const context = buildAiRecommendationContext(archmageScenario());
  const plans = context.candidatePackage.deterministicSeedPlans;
  const serializedPlans = JSON.stringify(plans);

  assert.equal(plans.some((plan) => !plan || Object.keys(plan).length === 0), false);
  assert.equal(context.tacticalFacts.targetDistanceFt, 15);
  assert.equal(context.tacticalFacts.hasLineOfSight, true);
  assert.equal(context.tacticalFacts.coverAvailable, true);
  assert.equal(context.tacticalFacts.coverDistanceFt, 25);
  assert.equal(context.tacticalFacts.coverDirection, "right");
  assert.equal(context.tacticalFacts.darknessDistanceFt, 45);
  assert.equal(context.tacticalFacts.darknessDirection, "left");
  assert.equal(context.tacticalFacts.exitBlocked, true);
  assert.equal(context.tacticalFacts.currentConcentration, "Hex");

  assert.ok(context.candidatePackage.piecesBySlot.action.some((piece) => piece.optionId === "spell_guiding_bolt"));
  assert.ok(context.candidatePackage.piecesBySlot.action.some((piece) => piece.optionId === "spell_inflict_wounds"));
  assert.ok(context.candidatePackage.piecesBySlot.reaction.some((piece) => piece.optionId === "spell_shield"));
  assert.ok(context.candidatePackage.piecesBySlot.bonusAction.some((piece) => piece.optionId === "spell_hex"));
  assert.equal(context.candidatePackage.piecesBySlot.action.some((piece) => piece.optionId === "basic_object_interaction"), false);

  assert.ok(plans.some((plan) => plan.id === "plan_guiding_bolt_cover"));
  assert.ok(plans.some((plan) => plan.id === "plan_defensive_cover"));
  assert.ok(plans.some((plan) => plan.id === "plan_inflict_wounds_risky"));
  assert.equal(serializedPlans.includes("spell_fire_bolt"), false);
  assert.equal(serializedPlans.includes("spell_eldritch_blast"), false);
  assert.equal(plans.some((plan) => plan.planPieces.some((piece) => piece.optionId === "spell_hex")), false);
  assert.equal(plans.some((plan) => plan.planPieces.some((piece) => piece.slot === "Bonus Action" && piece.optionId === "basic_object_interaction")), false);
  assert.equal(/No resource cost/i.test(serializedPlans), false);

  const guiding = plans.find((plan) => plan.id === "plan_guiding_bolt_cover");
  const inflict = plans.find((plan) => plan.id === "plan_inflict_wounds_risky");
  const control = plans.find((plan) => plan.id === "plan_control_bane");
  assert.deepEqual(guiding.resourcesUsed, ["Level 1 spell slot"]);
  assert.match(guiding.concentrationImpact, /Keeps current Hex concentration/);
  assert.deepEqual(inflict.resourcesUsed, ["Level 1 spell slot"]);
  assert.equal(inflict.riskLevel, "high");
  assert.equal(inflict.legality, "conditional");
  assert.match(inflict.warnings.join(" "), /touch range/i);
  assert.match(control.concentrationImpact, /replace current Hex/i);
  assert.match(control.warnings.join(" "), /ends current Hex concentration/i);

  assert.ok(context.optionAudit.modelRelevantWarnings.some((warning) => /Hex is already active/i.test(warning)));
  assert.ok(context.optionAudit.modelRelevantWarnings.some((warning) => /Inflict Wounds requires touch range/i.test(warning)));
  assert.ok(context.optionAudit.modelRelevantWarnings.some((warning) => /Movement toward cover/i.test(warning)));
  assert.ok(context.optionAudit.modelRelevantWarnings.some((warning) => /15 ft distance/i.test(warning)));
  assert.equal((context.optionAudit.modelRelevantWarnings ?? []).some((warning) => /tactical metadata category/i.test(warning)), false);
});

test("deterministicSeedPlans is empty instead of empty objects when no valid seed exists", () => {
  const context = buildAiRecommendationContext({
    snapshot: {
      activeCharacter: { name: "Mara", classes: [], race: {}, combat: {}, resources: {}, features: {}, inventory: {}, spells: {} },
      combatState: { current: {}, turn: {}, resourcesUsed: {} }
    },
    groups: {},
    recommendationSets: [{ title: "Empty stale set", pieces: [] }],
    answers: { goal: "damage" },
    userNotes: ""
  });

  assert.deepEqual(context.candidatePackage.deterministicSeedPlans, []);
});

function archmageScenario() {
  return {
    snapshot: {
      activeCharacter: {
        name: "Eustace Farthington",
        level: 5,
        race: { name: "Variant Human" },
        classes: [{ name: "Cleric", level: 2 }, { name: "Sorcerer", level: 1 }, { name: "Warlock", level: 2 }],
        stats: { str: 10, dex: 12, con: 14, int: 10, wis: 14, cha: 18 },
        combat: { maxHp: 47, currentHp: 47, ac: 17, speed: { walk: 30 } },
        resources: { spellSlots: { 1: 4 } },
        features: {},
        inventory: {},
        spells: { attackBonus: 7, saveDc: 15 }
      },
      combatState: {
        current: { hp: 47, tempHp: 0, ac: 17, conditions: [], concentration: "Hex", activeEffects: [] },
        turn: { actionUsed: false, bonusActionUsed: false, reactionUsed: false, movementUsed: 0 },
        resourcesUsed: { spellSlots: { 1: 2 }, classResources: {}, itemCharges: {} }
      }
    },
    groups: {
      actions: [
        { id: "action_dodge", name: "Dodge", source: "basic", available: true, cost: { action: true }, description: "Focus on avoiding attacks." },
        { id: "basic_object_interaction", name: "Object Interaction", source: "basic", available: true, cost: { object: true }, description: "Interact with one object." }
      ],
      bonus: [
        spell("spell_hex", "Hex", { bonus: true, resource: { type: "spellSlot", level: 1 } }, { concentration: true, castingCost: "bonus", range: "90 ft." }),
        spell("spell_sanctuary", "Sanctuary", { bonus: true, resource: { type: "spellSlot", level: 1 } }, { concentration: false, castingCost: "bonus", range: "30 ft." }),
        spell("spell_shield_of_faith", "Shield of Faith", { bonus: true, resource: { type: "spellSlot", level: 1 } }, { concentration: true, castingCost: "bonus", range: "60 ft." })
      ],
      resources: [
        spell("spell_guiding_bolt", "Guiding Bolt", { action: true, resource: { type: "spellSlot", level: 1 } }, { concentration: false, range: "120 ft." }, { range: { type: "ranged", label: "120 ft", normal: 120 }, rolls: [{ id: "damage", type: "damage", formula: "4d6", damageType: "radiant" }] }),
        spell("spell_inflict_wounds", "Inflict Wounds", { action: true, resource: { type: "spellSlot", level: 1 } }, { concentration: false, range: "Touch" }, { range: { type: "melee", label: "Touch", normal: 5 }, rolls: [{ id: "damage", type: "damage", formula: "3d10", damageType: "necrotic" }] }),
        spell("spell_bane", "Bane", { action: true, resource: { type: "spellSlot", level: 1 } }, { concentration: true, range: "30 ft.", saveAbility: "cha", requiresSave: true }),
        spell("spell_bless", "Bless", { action: true, resource: { type: "spellSlot", level: 1 } }, { concentration: true, range: "30 ft." })
      ],
      reaction: [
        spell("spell_shield", "Shield", { reaction: true, resource: { type: "spellSlot", level: 1 } }, { concentration: false, castingCost: "reaction" }),
        spell("spell_absorb_elements", "Absorb Elements", { reaction: true, resource: { type: "spellSlot", level: 1 } }, { concentration: false, castingCost: "reaction" })
      ],
      movement: [{ id: "movement_walk", name: "Move", source: "basic", group: "movement", available: true, cost: { movement: true }, description: "Move up to your speed." }]
    },
    recommendationSets: [],
    answers: { goal: "damage", distance: "unknown" },
    userNotes: "Archmage is 15 ft away. Line of sight exists. Cover is 25 ft to the right. Darkness is 45 ft to the left. The exit behind me is blocked. Hex is active on Archmage.",
    selectedCreatures: [{ name: "Archmage", action: [{ name: "Dagger", entries: ["Melee weapon attack."] }] }]
  };
}

function spell(id, name, cost, spellData, extra = {}) {
  return {
    id,
    name,
    source: "spell",
    available: true,
    cost,
    resource: cost.resource ? `Level ${cost.resource.level} spell slot` : null,
    spell: { level: cost.resource?.level ?? 0, ...spellData },
    ...extra
  };
}

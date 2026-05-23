import assert from "node:assert/strict";
import test from "node:test";
import { buildAiRecommendationContext } from "../js/player-combat/ai/aiRecommendationContext.js";

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
  assert.equal(context.schemaVersion, "combat-turn-recommendation/v2");
  assert.equal(context.combatState.hp.current, 30);
  assert.equal(context.playerIntent.userNotes, "Enemy is nearly defeated.");
  assert.equal(context.wizard, undefined);
  assert.equal(context.turnRules.actionEconomy.maxActions, 1);
  assert.equal(Boolean(context.classTactics.fighter), true);
  assert.equal(Boolean(context.classTactics.rogue), true);
  assert.equal(context.classTactics.wizard, undefined);
  assert.equal(context.classTactics.rogue.reminderQuestions.includes("Does the rogue have advantage?"), true);
  assert.equal(context.availableOptions.attacks[0].attack.count, 2);
  assert.equal(context.availableOptions.spells.length, 0);
  assert.equal(context.unavailableOptions.spells[0].id, "spell_fireball");
  assert.equal(context.optionIndex.some((option) => option.id === "attack_rapier"), true);
  assert.equal(context.optionIndex.some((option) => option.id === "spell_fireball"), false);
  assert.equal(context.deterministicRecommendations[0].pieces[0].option.id, "attack_rapier");
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
  assert.equal(context.deterministicRecommendations[0].title, "Untitled recommendation");
  assert.equal(context.deterministicRecommendations[0].pieces.length, 2);
  assert.equal(context.deterministicRecommendations[0].pieces[0].option.name, "Unknown option");
  assert.deepEqual(context.deterministicRecommendations[0].warnings, []);
});

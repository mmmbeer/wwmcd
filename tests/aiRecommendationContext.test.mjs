import assert from "node:assert/strict";
import test from "node:test";
import { buildAiRecommendationContext } from "../js/player-combat/ai/aiRecommendationContext.js";

test("AI recommendation context includes character, combat, wizard, options, and deterministic sets", () => {
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
        classes: [{ name: "Fighter", level: 5 }],
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
    groups: { attacks: [option] },
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
  assert.equal(context.combatState.hp.current, 30);
  assert.equal(context.wizard.userNotes, "Enemy is nearly defeated.");
  assert.equal(context.availableOptions.attacks[0].attack.count, 2);
  assert.equal(context.deterministicRecommendations[0].pieces[0].option.id, "attack_rapier");
});

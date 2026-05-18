import assert from "node:assert/strict";
import test from "node:test";

import { getCombatOptions } from "../js/player-combat/rules/combatOptionsService.js";

const combatState = {
  turn: { actionUsed: false, bonusActionUsed: false, reactionUsed: false, objectInteractionUsed: false, movementUsed: 0 },
  current: { conditions: [] },
  resourcesUsed: { spellSlots: {}, classResources: {} }
};

test("rogue level infers Cunning Action bonus options", () => {
  const groups = getCombatOptions({
    character: baseCharacter({
      classes: [{ name: "Rogue", level: 2 }],
      features: { class: [], race: [], feats: [], other: [] }
    }),
    combatState,
    referenceData: null
  });

  assert.ok(groups.bonus.some((option) => option.name === "Cunning Action: Dash"));
  assert.ok(groups.bonus.some((option) => option.name === "Cunning Action: Disengage"));
  assert.ok(groups.bonus.some((option) => option.name === "Cunning Action: Hide"));
  assert.equal(groups.bonus.find((option) => option.name === "Cunning Action: Dash").cost.bonus, true);
});

test("class, racial, and feat descriptions become action economy options", () => {
  const groups = getCombatOptions({
    character: baseCharacter({
      features: {
        class: [{ name: "Battle Cry", description: "As an action, choose allies that can hear you." }],
        race: [{ name: "Fey Step", description: "As a bonus action, magically teleport up to 30 feet." }],
        feats: [{ name: "Defensive Duelist" }, { name: "Chromatic Gift" }],
        other: []
      }
    }),
    combatState,
    referenceData: {
      indexes: {
        featIndexByName: new Map([
          ["defensive duelist", { name: "Defensive Duelist", description: "Use your reaction to add your proficiency bonus to AC." }],
          ["chromatic gift", { name: "Chromatic Gift", description: "Empower a weapon (bonus action). Gain resistance in reaction to damage." }]
        ])
      }
    }
  });

  assert.ok(groups.actions.some((option) => option.name === "Battle Cry"));
  assert.ok(groups.bonus.some((option) => option.name === "Fey Step"));
  assert.ok(groups.reaction.some((option) => option.name === "Defensive Duelist"));
  assert.ok(groups.bonus.some((option) => option.name === "Chromatic Gift"));
  assert.ok(groups.reaction.some((option) => option.name === "Chromatic Gift"));
});

test("bonus and reaction spell activation objects sort into matching groups", () => {
  const groups = getCombatOptions({
    character: baseCharacter({
      resources: { spellSlots: { 1: 2 }, classResources: [], limitedUses: [] },
      spells: {
        spellcastingAbility: "wis",
        prepared: [
          { name: "Misty Step", level: 1, activation: { activationTime: 1, activationType: "Bonus Action" } },
          { name: "Shield", level: 1, activation: { activationTime: 1, activationType: { name: "Reaction" } } }
        ],
        known: [],
        cantrips: []
      }
    }),
    combatState,
    referenceData: null
  });

  assert.ok(groups.bonus.some((option) => option.name === "Misty Step"));
  assert.ok(groups.reaction.some((option) => option.name === "Shield"));
});

function baseCharacter(overrides = {}) {
  return {
    classes: [],
    stats: { str: 10, dex: 14, con: 12, int: 10, wis: 12, cha: 10 },
    combat: { proficiencyBonus: 2, speed: { walk: 30 } },
    resources: { spellSlots: {}, classResources: [], limitedUses: [] },
    inventory: { weapons: [] },
    spells: { prepared: [], known: [], cantrips: [] },
    features: { class: [], race: [], feats: [], other: [] },
    ...overrides
  };
}

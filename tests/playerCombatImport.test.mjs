import assert from "node:assert/strict";
import test from "node:test";

import { normalizeCharacter } from "../js/player-combat/normalizers/characterNormalizer.js";
import { createStateManager } from "../js/player-combat/core/stateManager.js";
import { applyActionEconomyRules, getMovementRemaining } from "../js/player-combat/rules/actionEconomyRules.js";
import { getSpellActions } from "../js/player-combat/rules/spellActions.js";
import { getWeaponActions } from "../js/player-combat/rules/weaponActions.js";

test("normalizes D&D Beyond-style weapons, spells, slots, and casting ability", () => {
  const raw = {
    name: "Nyx",
    classes: [{ level: 5, definition: { name: "Wizard", spellCastingAbilityId: 4 } }],
    stats: [
      { id: 1, value: 8 },
      { id: 2, value: 16 },
      { id: 3, value: 14 },
      { id: 4, value: 18 },
      { id: 5, value: 10 },
      { id: 6, value: 12 }
    ],
    baseHitPoints: 32,
    spellSlots: [{ level: 1, available: 4 }, { level: 2, available: 3 }],
    inventory: [{
      equipped: true,
      definition: {
        name: "Rapier",
        filterType: "Weapon",
        type: "Martial Melee Weapon",
        damage: { diceString: "1d8" },
        damageType: { name: "piercing" },
        properties: [{ name: "Finesse" }]
      }
    }],
    classSpells: [{
      spellCastingAbilityId: 4,
      spells: [{
        prepared: true,
        definition: {
          name: "Fire Bolt",
          level: 0,
          activation: { activationType: 1 },
          description: "Make a ranged spell attack. On a hit, the target takes 1d10 fire damage."
        }
      }]
    }]
  };

  const { character, errors } = normalizeCharacter(raw);

  assert.deepEqual(errors, []);
  assert.equal(character.spells.spellcastingAbility, "int");
  assert.equal(character.spells.attackBonus, 7);
  assert.equal(character.resources.spellSlots[1], 4);
  assert.equal(character.inventory.weapons[0].name, "Rapier");
  assert.equal(character.inventory.weapons[0].damageType, "piercing");
  assert.equal(character.spells.cantrips[0].name, "Fire Bolt");
});

test("weapon actions use finesse and spell actions expose attack metadata", () => {
  const character = {
    stats: { str: 8, dex: 16, con: 14, int: 18, wis: 10, cha: 12 },
    combat: { proficiencyBonus: 3 },
    inventory: {
      weapons: [{
        name: "Rapier",
        type: "Martial Melee Weapon",
        damage: { diceString: "1d8" },
        damageType: "piercing",
        properties: "Finesse"
      }]
    },
    resources: { spellSlots: { 1: 1 } },
    spells: {
      spellcastingAbility: "int",
      attackBonus: 7,
      saveDc: 15,
      prepared: [{
        name: "Burning Hands",
        level: 1,
        castingTime: "1 action",
        description: "Each creature must make a Dexterity saving throw. A creature takes 3d6 fire damage.",
        saveAbility: "dex"
      }],
      known: [],
      cantrips: []
    }
  };
  const combatState = { resourcesUsed: { spellSlots: {} } };

  const weapon = getWeaponActions(character, null)[0];
  const spell = getSpellActions(character, combatState, null)[0];

  assert.equal(weapon.rolls.find((roll) => roll.id === "attack").formula, "1d20+6");
  assert.equal(weapon.rolls.find((roll) => roll.id === "damage").formula, "1d8+3");
  assert.ok(weapon.meta.includes("DEX attack"));
  assert.ok(spell.meta.includes("DEX save DC 15"));
  assert.equal(spell.rolls[0].formula, "3d6");
});

test("condition rules block movement and add simple roll warnings", () => {
  const character = { combat: { speed: { walk: 30 } } };
  const combatState = {
    turn: { actionUsed: false, bonusActionUsed: false, reactionUsed: false, movementUsed: 0 },
    current: { conditions: ["Grappled", "Poisoned", "Prone"] }
  };
  const [movement, attack, check] = applyActionEconomyRules([
    { id: "move", name: "Move", cost: { movement: true }, rolls: [] },
    { id: "attack", name: "Attack", cost: { action: true }, tags: ["attack"], rolls: [{ type: "attack" }] },
    { id: "hide", name: "Hide", cost: { action: true }, rolls: [{ type: "check" }] }
  ], character, combatState);

  assert.equal(getMovementRemaining(character, combatState), 0);
  assert.equal(movement.available, false);
  assert.deepEqual(movement.unavailableReasons, ["Movement blocked by Grappled."]);
  assert.ok(movement.warnings.includes("Prone: standing costs half your speed."));
  assert.ok(attack.warnings.includes("Poisoned: attack rolls have disadvantage."));
  assert.ok(check.warnings.includes("Poisoned: ability checks have disadvantage."));
});

test("manual spell slot controls persist only in combat state", () => {
  const storage = createMemoryStorage();
  const eventBus = { emit() {} };
  const stateManager = createStateManager({ storage, eventBus });
  const character = {
    id: "caster",
    name: "Caster",
    importedAt: "2026-05-17T00:00:00.000Z",
    combat: { maxHp: 10, ac: 12, speed: { walk: 30 } },
    resources: { spellSlots: { 1: 2 } }
  };

  stateManager.importCharacter(character);
  stateManager.setSpellSlotUsed(1, 1);
  stateManager.adjustSpellSlotUsed(1, 5);

  assert.equal(stateManager.getCombatState().resourcesUsed.spellSlots[1], 2);
  assert.equal(stateManager.getActiveCharacter().resources.spellSlots[1], 2);

  stateManager.resetSpellSlots(1);

  assert.equal(stateManager.getCombatState().resourcesUsed.spellSlots[1], 0);
});

function createMemoryStorage() {
  let characters = [];
  let activeCharacterId = null;
  let combatStates = {};
  let importHistory = [];
  return {
    available: true,
    getCharacters: () => characters,
    saveCharacters: (value) => { characters = value; },
    getActiveCharacterId: () => activeCharacterId,
    saveActiveCharacterId: (value) => { activeCharacterId = value; },
    getCombatStates: () => combatStates,
    saveCombatStates: (value) => { combatStates = value; },
    getImportHistory: () => importHistory,
    saveImportHistory: (value) => { importHistory = value; }
  };
}

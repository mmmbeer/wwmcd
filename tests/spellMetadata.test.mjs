import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { transformCombatData } from "../js/player-combat/data/combatDataTransformer.js";
import { getSpellActions } from "../js/player-combat/rules/spellActions.js";

const ROLE_ENUM = new Set([
  "damage",
  "control",
  "support",
  "defense",
  "mobility",
  "utility",
  "advantageSetup",
  "advantageAmplifier",
  "minionClear",
  "bossDebuff",
  "saveOrSuck",
  "nova",
  "escape",
  "reactionProtection"
]);
const USEFULNESS_ENUM = new Set(["avoid", "situational", "normal", "strong", "signature"]);
const SITUATION_ENUM = new Set(["single", "multiple", "bigBad", "bigBadMinions", "ally", "self"]);
const DIFFICULTY_ENUM = new Set(["easy", "medium", "hard", "deadly"]);
const RANGE_ENUM = new Set(["melee", "near", "long", "far"]);

test("every reference spell has deterministic tactical metadata enums", () => {
  const spells = readSpells();

  assert.equal(spells.length, 569);
  for (const spell of spells) {
    assert.ok(spell.tactics, `${spell.name} should have tactics metadata`);
    assert.ok(USEFULNESS_ENUM.has(spell.tactics.combatUsefulness), `${spell.name} has invalid combatUsefulness`);
    assert.ok(spell.tactics.roles?.length, `${spell.name} should have at least one role`);
    assertEnumList(spell.tactics.roles, ROLE_ENUM, `${spell.name} roles`);
    assertEnumList(spell.tactics.goodSituations, SITUATION_ENUM, `${spell.name} goodSituations`);
    assertEnumList(spell.tactics.badSituations, SITUATION_ENUM, `${spell.name} badSituations`);
    assertEnumList(spell.tactics.goodDifficulties, DIFFICULTY_ENUM, `${spell.name} goodDifficulties`);
    assertEnumList(spell.tactics.badDifficulties, DIFFICULTY_ENUM, `${spell.name} badDifficulties`);
    assertEnumList(spell.tactics.goodRanges, RANGE_ENUM, `${spell.name} goodRanges`);
    assertEnumList(spell.tactics.badRanges, RANGE_ENUM, `${spell.name} badRanges`);
  }
});

test("spell metadata separates damage, healing, defense, and utility recommendations", () => {
  const byName = new Map(readSpells().map((spell) => [spell.name, spell]));

  assert.ok(byName.get("Fireball").tactics.roles.includes("damage"));
  assert.ok(byName.get("Fireball").tactics.roles.includes("minionClear"));
  assert.equal(byName.get("Cure Wounds").tactics.roles.includes("damage"), false);
  assert.deepEqual(byName.get("Cure Wounds").tactics.roles, ["support"]);
  assert.equal(byName.get("Shield").tactics.roles.includes("damage"), false);
  assert.ok(byName.get("Shield").tactics.roles.includes("defense"));
  assert.deepEqual(byName.get("Mending").tactics.roles, ["utility"]);
  assert.equal(byName.get("Mending").tactics.combatUsefulness, "avoid");
});

test("imported character spells inherit reference tactics metadata", () => {
  const spells = readSpells();
  const referenceData = transformCombatData({ spells });
  const character = {
    stats: { int: 18, wis: 16, cha: 12 },
    combat: { proficiencyBonus: 3 },
    resources: { spellSlots: { 1: 2, 3: 1 } },
    spells: {
      spellcastingAbility: "int",
      attackBonus: 7,
      saveDc: 15,
      prepared: [
        { name: "Fireball", level: 3 },
        { name: "Cure Wounds", level: 1 },
        { name: "Shield", level: 1 }
      ],
      known: [],
      cantrips: []
    }
  };

  const options = getSpellActions(character, baseCombatState(), referenceData);
  const fireball = options.find((option) => option.name === "Fireball");
  const cureWounds = options.find((option) => option.name === "Cure Wounds");
  const shield = options.find((option) => option.name === "Shield");

  assert.ok(fireball.tactics.roles.includes("damage"));
  assert.ok(fireball.spell.reference.tactics.roles.includes("minionClear"));
  assert.deepEqual(cureWounds.tactics.roles, ["support"]);
  assert.equal(cureWounds.tactics.roles.includes("damage"), false);
  assert.ok(shield.tactics.roles.includes("defense"));
  assert.equal(shield.tactics.roles.includes("damage"), false);
});

function assertEnumList(values = [], enumValues, label) {
  for (const value of values) {
    assert.ok(enumValues.has(value), `${label} contains invalid value ${value}`);
  }
}

function readSpells() {
  return JSON.parse(readFileSync(new URL("../data/spells.json", import.meta.url), "utf8").replace(/^\uFEFF/, ""));
}

function baseCombatState() {
  return {
    turn: { actionUsed: false, bonusActionUsed: false, reactionUsed: false, objectInteractionUsed: false, movementUsed: 0 },
    current: { conditions: [] },
    resourcesUsed: { spellSlots: {}, classResources: {} }
  };
}

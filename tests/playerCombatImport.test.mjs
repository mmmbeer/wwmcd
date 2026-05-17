import assert from "node:assert/strict";
import test from "node:test";

import { normalizeCharacter } from "../js/player-combat/normalizers/characterNormalizer.js";
import { createStateManager } from "../js/player-combat/core/stateManager.js";
import { importCharacterFromPdfText } from "../js/player-combat/importers/ddbPdfImporterAdapter.js";
import { applyActionEconomyRules, getMovementRemaining } from "../js/player-combat/rules/actionEconomyRules.js";
import { getAttackCount } from "../js/player-combat/rules/attackCountRules.js";
import { getCombatOptions } from "../js/player-combat/rules/combatOptionsService.js";
import { getResourceActions } from "../js/player-combat/rules/resourceActions.js";
import { resetsOnShortRest } from "../js/player-combat/rules/restRules.js";
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
    classResources: [{ name: "Arcane Recovery", maxUses: 1, resetType: "Long Rest" }],
    limitedUses: [{ definition: { name: "Fey Step", limitedUse: { maxUses: 2, resetType: "Long Rest" } } }],
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
  assert.equal(character.resources.classResources[0].name, "Arcane Recovery");
  assert.equal(character.resources.classResources[0].max, 1);
  assert.equal(character.resources.limitedUses[0].name, "Fey Step");
  assert.equal(character.resources.limitedUses[0].max, 2);
  assert.equal(character.inventory.weapons[0].name, "Rapier");
  assert.equal(character.inventory.weapons[0].damageType, "piercing");
  assert.equal(character.spells.cantrips[0].name, "Fire Bolt");
});

test("imports fillable PDF form fields into the player normalizer shape", () => {
  const pdf = [
    "%PDF-1.7",
    pdfField("CharacterName", "Pdf Hero"),
    pdfField("CLASS LEVEL", "Cleric 3"),
    pdfField("RACE", "Hill Dwarf"),
    pdfField("STR", "12"),
    pdfField("DEX", "10"),
    pdfField("CON", "14"),
    pdfField("INT", "8"),
    pdfField("WIS", "16"),
    pdfField("CHA", "13"),
    pdfField("MaxHP", "24"),
    pdfField("CurrentHP", "18"),
    pdfField("TempHP", "5"),
    pdfField("AC", "17"),
    pdfField("Speed", "25 ft"),
    pdfField("ProfBonus", "+2"),
    pdfField("Wpn Name", "Mace"),
    pdfField("Wpn1 Damage", "1d6 bludgeoning"),
    pdfField("spellCastingAbility0", "WIS"),
    pdfField("spellHeader1", "1st Level"),
    pdfField("spellSlotHeader1", "4 Slots"),
    pdfField("spellName1", "Guiding Bolt"),
    pdfField("spellPrepared1", "Yes"),
    pdfField("spellCastingTime1", "1 action"),
    pdfField("spellRange1", "120 ft"),
    pdfField("spellDuration1", "1 round"),
    pdfField("spellNotes1", "Make a ranged spell attack. On a hit, the target takes 4d6 radiant damage.")
  ].join("\n");

  const imported = importCharacterFromPdfText(pdf, { sourceName: "hero.pdf" });
  const { character, errors } = normalizeCharacter(imported.raw);

  assert.equal(imported.accepted, true);
  assert.deepEqual(errors, []);
  assert.equal(character.name, "Pdf Hero");
  assert.equal(character.classes[0].name, "Cleric");
  assert.equal(character.classes[0].level, 3);
  assert.equal(character.combat.maxHp, 24);
  assert.equal(character.combat.currentHp, 18);
  assert.equal(character.combat.tempHp, 5);
  assert.equal(character.combat.ac, 17);
  assert.equal(character.combat.speed.walk, 25);
  assert.equal(character.stats.wis, 16);
  assert.equal(character.resources.spellSlots[1], 4);
  assert.equal(character.spells.spellcastingAbility, "wis");
  assert.equal(character.spells.prepared[0].name, "Guiding Bolt");
  assert.equal(character.inventory.weapons[0].name, "Mace");
  assert.equal(character.inventory.weapons[0].damageType, "bludgeoning");
});

test("rejects PDFs without fillable form fields", () => {
  const imported = importCharacterFromPdfText("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>", { sourceName: "flat.pdf" });

  assert.equal(imported.accepted, false);
  assert.equal(imported.raw, null);
  assert.ok(imported.errors[0].includes("No fillable PDF form fields"));
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

test("combat options expose free actions and inferred extra attacks", () => {
  const character = {
    classes: [{ name: "Fighter", level: 11 }],
    features: { class: [{ name: "Extra Attack" }] },
    stats: { str: 16, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
    combat: { proficiencyBonus: 4, speed: { walk: 30 } },
    resources: { spellSlots: {}, classResources: [], limitedUses: [] },
    inventory: { weapons: [] },
    spells: { known: [], prepared: [], cantrips: [] }
  };
  const combatState = {
    turn: { actionUsed: false, bonusActionUsed: false, reactionUsed: false, objectInteractionUsed: false, movementUsed: 0 },
    current: { conditions: [] },
    resourcesUsed: { spellSlots: {}, classResources: {} }
  };

  const groups = getCombatOptions({ character, combatState, referenceData: null });
  const attack = groups.actions.find((option) => option.id === "basic_attack");

  assert.equal(getAttackCount(character), 3);
  assert.ok(attack.description.includes("3 attacks"));
  assert.ok(groups.free.some((option) => option.id === "basic_object_interaction"));
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

test("casting a concentration spell tracks concentration in combat state", () => {
  const storage = createMemoryStorage();
  const stateManager = createStateManager({ storage, eventBus: { emit() {} } });
  const character = {
    id: "concentrator",
    name: "Concentrator",
    importedAt: "2026-05-17T00:00:00.000Z",
    combat: { maxHp: 10, ac: 12, speed: { walk: 30 } },
    resources: { spellSlots: { 1: 2 } }
  };

  stateManager.importCharacter(character);
  stateManager.useCombatOption({
    name: "Bless",
    cost: { action: true, resource: { type: "spellSlot", level: 1 } },
    spell: { level: 1, concentration: true }
  });

  assert.equal(stateManager.getCombatState().current.concentration, "Bless");
  assert.equal(stateManager.getCombatState().resourcesUsed.spellSlots[1], 1);
  assert.equal(stateManager.getActiveCharacter().resources.spellSlots[1], 2);
});

test("manual limited resource controls persist only in combat state", () => {
  const storage = createMemoryStorage();
  const eventBus = { emit() {} };
  const stateManager = createStateManager({ storage, eventBus });
  const character = {
    id: "monk",
    name: "Monk",
    importedAt: "2026-05-17T00:00:00.000Z",
    combat: { maxHp: 22, ac: 15, speed: { walk: 40 } },
    resources: {
      spellSlots: {},
      classResources: [{ id: "resource-ki", name: "Ki", max: 3, reset: "Short Rest" }],
      limitedUses: []
    }
  };

  stateManager.importCharacter(character);
  stateManager.setClassResourceUsed("resource-ki", 2);
  stateManager.adjustClassResourceUsed("resource-ki", 5);

  assert.equal(stateManager.getCombatState().resourcesUsed.classResources["resource-ki"], 3);
  assert.equal(stateManager.getActiveCharacter().resources.classResources[0].max, 3);

  const [card] = getResourceActions(stateManager.getActiveCharacter(), stateManager.getCombatState());
  assert.equal(card.description, "0 of 3 remaining.");
  assert.ok(card.warnings.includes("Ki has no uses remaining."));

  stateManager.resetClassResources("resource-ki");

  assert.equal(stateManager.getCombatState().resourcesUsed.classResources["resource-ki"], 0);
});

test("short rest resets only explicit short-rest limited resources", () => {
  const storage = createMemoryStorage();
  const stateManager = createStateManager({ storage, eventBus: { emit() {} } });
  const character = {
    id: "mixed-rests",
    name: "Mixed Rests",
    importedAt: "2026-05-17T00:00:00.000Z",
    combat: { maxHp: 20, ac: 14, speed: { walk: 30 } },
    resources: {
      spellSlots: { 1: 2 },
      classResources: [
        { id: "resource-ki", name: "Ki", max: 3, reset: "Short Rest" },
        { id: "resource-arcane-recovery", name: "Arcane Recovery", max: 1, reset: "Long Rest" },
        { id: "resource-vague", name: "Vague Feature", max: 1, reset: "Rest" }
      ],
      limitedUses: []
    }
  };

  stateManager.importCharacter(character);
  stateManager.setSpellSlotUsed(1, 1);
  stateManager.setClassResourceUsed("resource-ki", 2);
  stateManager.setClassResourceUsed("resource-arcane-recovery", 1);
  stateManager.setClassResourceUsed("resource-vague", 1);
  stateManager.takeShortRest();

  assert.equal(stateManager.getCombatState().resourcesUsed.spellSlots[1], 1);
  assert.equal(stateManager.getCombatState().resourcesUsed.classResources["resource-ki"], 0);
  assert.equal(stateManager.getCombatState().resourcesUsed.classResources["resource-arcane-recovery"], 1);
  assert.equal(stateManager.getCombatState().resourcesUsed.classResources["resource-vague"], 1);
  assert.ok(stateManager.getCombatState().log[0].message.includes("Short rest"));
  assert.equal(stateManager.getActiveCharacter().resources.classResources[0].max, 3);
});

test("long rest resets tracked spell slots and limited resources", () => {
  const storage = createMemoryStorage();
  const stateManager = createStateManager({ storage, eventBus: { emit() {} } });
  const character = {
    id: "long-rest",
    name: "Long Rest",
    importedAt: "2026-05-17T00:00:00.000Z",
    combat: { maxHp: 20, ac: 14, speed: { walk: 30 } },
    resources: {
      spellSlots: { 1: 2 },
      classResources: [{ id: "resource-arcane-recovery", name: "Arcane Recovery", max: 1, reset: "Long Rest" }],
      limitedUses: []
    }
  };

  stateManager.importCharacter(character);
  stateManager.setSpellSlotUsed(1, 1);
  stateManager.setClassResourceUsed("resource-arcane-recovery", 1);
  stateManager.takeLongRest();

  assert.deepEqual(stateManager.getCombatState().resourcesUsed.spellSlots, {});
  assert.deepEqual(stateManager.getCombatState().resourcesUsed.classResources, {});
  assert.ok(stateManager.getCombatState().log[0].message.includes("Long rest"));
  assert.equal(stateManager.getActiveCharacter().resources.classResources[0].max, 1);
});

test("short-rest reset text detection stays conservative", () => {
  assert.equal(resetsOnShortRest("Short Rest"), true);
  assert.equal(resetsOnShortRest("Short or Long Rest"), true);
  assert.equal(resetsOnShortRest("Long Rest"), false);
  assert.equal(resetsOnShortRest("Rest"), false);
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

function pdfField(name, value) {
  return `<< /T (${name}) /V (${value}) >>`;
}

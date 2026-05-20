import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizeCharacter } from "../js/player-combat/normalizers/characterNormalizer.js";
import { createStateManager } from "../js/player-combat/core/stateManager.js";
import { importCharacterFromPdfBuffer, importCharacterFromPdfText } from "../js/player-combat/importers/ddbPdfImporterAdapter.js";
import { transformCombatData } from "../js/player-combat/data/combatDataTransformer.js";
import { applyActionEconomyRules, getMovementRemaining } from "../js/player-combat/rules/actionEconomyRules.js";
import { getAttackCount } from "../js/player-combat/rules/attackCountRules.js";
import { getCombatOptions } from "../js/player-combat/rules/combatOptionsService.js";
import { getResourceActions } from "../js/player-combat/rules/resourceActions.js";
import { resetsOnShortRest } from "../js/player-combat/rules/restRules.js";
import { getSpellActions } from "../js/player-combat/rules/spellActions.js";
import { getWeaponActions } from "../js/player-combat/rules/weaponActions.js";
import { renderGroup } from "../js/player-combat/ui/actionOptionRenderers.js";

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

test("normalizer infers monk Ki when class resource data is missing", () => {
  const { character, errors } = normalizeCharacter({
    name: "Focus Monk",
    classes: [{ level: 4, definition: { name: "Monk" } }],
    stats: [
      { id: 1, value: 10 },
      { id: 2, value: 16 },
      { id: 3, value: 14 },
      { id: 4, value: 10 },
      { id: 5, value: 14 },
      { id: 6, value: 8 }
    ],
    baseHitPoints: 28
  });

  assert.deepEqual(errors, []);
  assert.equal(character.resources.classResources[0].id, "resource-ki");
  assert.equal(character.resources.classResources[0].name, "Ki");
  assert.equal(character.resources.classResources[0].max, 4);
  assert.equal(character.resources.classResources[0].reset, "Short Rest");
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

test("imports D&D Beyond PDF feature blocks into combat feature options", () => {
  const pdf = [
    "%PDF-1.7",
    pdfField("CharacterName", "Feature Hero"),
    pdfField("CLASS LEVEL", "Rogue 5"),
    pdfField("RACE", "Eladrin"),
    pdfField("STR", "10"),
    pdfField("DEX", "18"),
    pdfField("CON", "12"),
    pdfField("INT", "10"),
    pdfField("WIS", "12"),
    pdfField("CHA", "14"),
    pdfField("MaxHP", "38"),
    pdfField("FeaturesTraits1", [
      "=== ROGUE FEATURES ===",
      "* Cunning Action • PHB 96",
      "On your turn, you can take one of the following actions as a Bonus Action: Dash, Disengage, or Hide.",
      "| 1 Bonus Action",
      "* Uncanny Dodge • PHB 96",
      "When an attacker you can see hits you with an attack, you can take a Reaction to halve the attack's damage.",
      "| 1 Reaction"
    ].join("\\n"))
  ].join("\n");

  const imported = importCharacterFromPdfText(pdf, { sourceName: "features.pdf" });
  const { character } = normalizeCharacter(imported.raw);
  const groups = getCombatOptions({ character, combatState: baseCombatState(), referenceData: minimalReferenceData() });

  assert.ok(character.features.other.some((feature) => feature.name === "Cunning Action"));
  assert.ok(groups.bonus.some((option) => option.name === "Cunning Action: Dash"));
  assert.ok(groups.bonus.some((option) => option.name === "Cunning Action: Disengage"));
  assert.ok(groups.bonus.some((option) => option.name === "Cunning Action: Hide"));
  assert.ok(groups.reaction.some((option) => option.name === "Uncanny Dodge"));
});

test("example PDF sheets add applicable imported feature actions", async () => {
  const imported = await importCharacterFromPdfTextOrBuffer("docs/example-sheets/mwokasch_134724530.pdf");
  const { character } = normalizeCharacter(imported.raw);
  const groups = getCombatOptions({ character, combatState: baseCombatState(), referenceData: realReferenceData() });

  assert.ok(character.features.other.some((feature) => feature.name === "Cunning Action"));
  assert.ok(groups.bonus.some((option) => option.name === "Cunning Action: Dash"));
  assert.ok(groups.bonus.some((option) => option.name === "Steady Aim"));
  assert.ok(groups.reaction.some((option) => option.name === "Uncanny Dodge"));
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
      cantrips: [{
        name: "Shillelagh",
        level: 0,
        activation: { activationType: 2 },
        range: "Touch",
        description: "The wood of a club or quarterstaff you are holding is imbued with nature's power."
      }]
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
  assert.equal(spell.cost.action, true);
  assert.equal(spell.spell.range, undefined);

  const cantrip = getSpellActions(character, combatState, null)[1];
  assert.equal(cantrip.cost.bonus, true);
  assert.equal(cantrip.spell.range, "Touch");
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

  assert.equal(getAttackCount(character), 2);
  assert.equal(groups.actions.some((option) => option.id === "basic_attack"), false);
  assert.ok(groups.attacks.some((option) => option.id === "attack_unarmed_strike"));
  assert.ok(groups.free.some((option) => option.id === "basic_object_interaction"));
});

test("bonus and reaction spells appear in matching action economy groups", () => {
  const character = {
    combat: { proficiencyBonus: 2, speed: { walk: 30 } },
    resources: { spellSlots: { 1: 2 } },
    inventory: { weapons: [] },
    spells: {
      spellcastingAbility: "wis",
      prepared: [
        { name: "Healing Word", level: 1, castingTime: "1 bonus action", range: "60 feet" },
        { name: "Shield", level: 1, activation: { activationType: { id: 3, name: "Reaction" } }, range: "Self" }
      ],
      known: [],
      cantrips: []
    }
  };
  const combatState = {
    turn: { actionUsed: false, bonusActionUsed: false, reactionUsed: false, objectInteractionUsed: false, movementUsed: 0 },
    current: { conditions: [] },
    resourcesUsed: { spellSlots: {}, classResources: {} }
  };

  const groups = getCombatOptions({ character, combatState, referenceData: null });

  assert.ok(groups.bonus.some((option) => option.name === "Healing Word"));
  assert.ok(groups.reaction.some((option) => option.name === "Shield"));
  assert.equal(groups.bonus.find((option) => option.name === "Healing Word").spell.castingCost, "bonus");
  assert.equal(groups.reaction.find((option) => option.name === "Shield").spell.castingCost, "reaction");
});

test("feature-granted spellcasting does not require imported spell slots", () => {
  const character = {
    id: "air-genasi-monk",
    name: "Air Genasi Monk",
    level: 5,
    classes: [{ name: "Monk", level: 5 }],
    race: {
      name: "Air Genasi",
      features: [{
        name: "Mingle with the Wind",
        description: "When you reach 3rd level, you can cast Feather Fall once with this trait. When you reach 5th level, you can cast Levitate once with this trait. You regain the ability to cast these spells when you finish a long rest. You can also cast these spells using spell slots you have of the appropriate level."
      }]
    },
    features: { race: [] },
    stats: { str: 10, dex: 16, con: 14, int: 10, wis: 16, cha: 8 },
    combat: { proficiencyBonus: 3, speed: { walk: 30 } },
    resources: { spellSlots: {}, classResources: [], limitedUses: [] },
    inventory: { weapons: [] },
    spells: { known: [], prepared: [], cantrips: [] }
  };

  const groups = getCombatOptions({ character, combatState: baseCombatState(), referenceData: featureSpellReferenceData() });
  const featherFall = groups.reaction.find((option) => option.name === "Mingle with the Wind: Feather Fall");
  const levitate = groups.actions.find((option) => option.name === "Mingle with the Wind: Levitate");

  assert.equal(featherFall?.available, true);
  assert.equal(levitate?.available, true);
  assert.equal(featherFall.cost.resource, undefined);
  assert.equal(levitate.cost.resource, undefined);
  assert.equal(levitate.source, "feature");
  assert.equal(levitate.spell.level, 2);
});

test("feature spell casts still count as leveled spellcasting", () => {
  const storage = createMemoryStorage();
  const stateManager = createStateManager({ storage, eventBus: { emit() {} } });
  const character = {
    id: "feature-caster",
    name: "Feature Caster",
    importedAt: "2026-05-20T00:00:00.000Z",
    combat: { maxHp: 10, ac: 12, speed: { walk: 30 } },
    resources: { spellSlots: {}, classResources: [], limitedUses: [] }
  };

  stateManager.importCharacter(character);
  stateManager.useCombatOption({
    name: "Mingle with the Wind: Levitate",
    source: "feature",
    cost: { action: true },
    spell: { level: 2, concentration: true }
  });

  const combatState = stateManager.getCombatState();
  assert.equal(combatState.turn.actionUsed, true);
  assert.equal(combatState.turn.leveledSpellCast, true);
  assert.equal(combatState.turn.leveledSpellName, "Mingle with the Wind: Levitate");
  assert.equal(combatState.current.concentrationSource, "feature");
});

test("compact action rows omit long descriptions and long attack notes", () => {
  const html = renderGroup("attacks", "Attacks", [{
    id: "attack_long_notes",
    name: "Quarterstaff",
    source: "weapon",
    tags: ["weapon", "attack"],
    cost: { action: true },
    description: "This full description belongs in the expanded details, not under the action name.",
    meta: [
      "DEX attack",
      "This long imported feature reminder should stay out of the compact Damage / Notes column because it belongs in details."
    ],
    rolls: [
      { id: "attack", label: "Roll Attack", formula: "1d20+6", type: "attack" },
      { id: "damage", label: "Roll Damage", formula: "1d6+3", type: "damage", damageType: "bludgeoning" }
    ]
  }], baseCombatState());

  const compactRow = html.split("option-detail-row")[0];
  assert.ok(!compactRow.includes("This full description belongs"));
  assert.ok(!compactRow.includes("This long imported feature reminder"));
  assert.ok(compactRow.includes("DEX attack"));
});

test("compact PDF spell casting-time abbreviations map to action types", () => {
  const character = {
    combat: { proficiencyBonus: 2, speed: { walk: 30 } },
    resources: { spellSlots: { 1: 3 } },
    inventory: { weapons: [] },
    spells: {
      spellcastingAbility: "wis",
      prepared: [
        { name: "Faerie Fire", level: 1, castingTime: "1A", range: "60 ft." },
        { name: "Healing Word", level: 1, castingTime: "1BA", range: "60 ft." },
        { name: "Shield", level: 1, castingTime: "1R", range: "Self" },
        { name: "Detect Magic", level: 1, castingTime: "1A + 10m", range: "Self" }
      ],
      known: [],
      cantrips: []
    }
  };
  const groups = getCombatOptions({ character, combatState: baseCombatState(), referenceData: null });

  assert.equal(groups.spells.find((option) => option.name === "Faerie Fire").spell.castingCost, "action");
  assert.equal(groups.spells.find((option) => option.name === "Healing Word").spell.castingCost, "bonus");
  assert.equal(groups.spells.find((option) => option.name === "Shield").spell.castingCost, "reaction");
  assert.equal(groups.spells.find((option) => option.name === "Detect Magic").spell.castingCost, "action");
  assert.ok(groups.bonus.some((option) => option.name === "Healing Word"));
  assert.ok(groups.reaction.some((option) => option.name === "Shield"));
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
    source: "spell",
    cost: { action: true, resource: { type: "spellSlot", level: 1 } },
    spell: { level: 1, concentration: true }
  });

  assert.equal(stateManager.getCombatState().current.concentration, "Bless");
  assert.equal(stateManager.getCombatState().current.concentrationSource, "spell");
  assert.equal(stateManager.getCombatState().resourcesUsed.spellSlots[1], 1);
  assert.equal(stateManager.getCombatState().turn.actionUsed, true);
  assert.equal(stateManager.getCombatState().turn.leveledSpellCast, true);
  assert.equal(stateManager.getCombatState().turn.leveledSpellName, "Bless");
  assert.equal(stateManager.getActiveCharacter().resources.spellSlots[1], 2);
});

test("casting cantrips uses action economy without spending slots", () => {
  const storage = createMemoryStorage();
  const stateManager = createStateManager({ storage, eventBus: { emit() {} } });
  const character = {
    id: "cantrip-caster",
    name: "Cantrip Caster",
    importedAt: "2026-05-17T00:00:00.000Z",
    combat: { maxHp: 10, ac: 12, speed: { walk: 30 } },
    resources: { spellSlots: { 1: 1 } }
  };

  stateManager.importCharacter(character);
  stateManager.useCombatOption({
    name: "Fire Bolt",
    source: "spell",
    cost: { action: true, resource: null },
    spell: { level: 0, concentration: false }
  });

  assert.equal(stateManager.getCombatState().turn.actionUsed, true);
  assert.deepEqual(stateManager.getCombatState().resourcesUsed.spellSlots, {});
  assert.equal(stateManager.getCombatState().turn.leveledSpellCast, false);
});

test("using Flurry of Blows spends tracked Ki and bonus action", () => {
  const storage = createMemoryStorage();
  const stateManager = createStateManager({ storage, eventBus: { emit() {} } });
  const character = {
    id: "flurry-monk",
    name: "Flurry Monk",
    importedAt: "2026-05-19T00:00:00.000Z",
    combat: { maxHp: 24, ac: 15, speed: { walk: 40 } },
    resources: {
      spellSlots: {},
      classResources: [{ id: "resource-ki", name: "Ki", max: 3, reset: "Short Rest" }],
      limitedUses: []
    }
  };

  stateManager.importCharacter(character);
  stateManager.useCombatOption({
    id: "monk_flurry_of_blows",
    name: "Flurry of Blows",
    source: "feature",
    tags: ["monk", "attack"],
    cost: { bonus: true, resource: { type: "classResource", id: "resource-ki", amount: 1, name: "Ki" } }
  });

  assert.equal(stateManager.getCombatState().turn.bonusActionUsed, true);
  assert.equal(stateManager.getCombatState().resourcesUsed.classResources["resource-ki"], 1);
  assert.equal(stateManager.getActiveCharacter().resources.classResources[0].max, 3);
});

test("spell casting updates matching action economy for cantrips", () => {
  const storage = createMemoryStorage();
  const stateManager = createStateManager({ storage, eventBus: { emit() {} } });
  const character = {
    id: "cantrip-economy",
    name: "Cantrip Economy",
    importedAt: "2026-05-19T00:00:00.000Z",
    combat: { maxHp: 10, ac: 12, speed: { walk: 30 } },
    resources: { spellSlots: {} }
  };

  stateManager.importCharacter(character);
  stateManager.useCombatOption({
    name: "Shillelagh",
    source: "spell",
    cost: { bonus: true, resource: null },
    spell: { level: 0, concentration: false }
  });

  assert.equal(stateManager.getCombatState().turn.bonusActionUsed, true);
  assert.equal(stateManager.getCombatState().turn.actionUsed, false);
  assert.equal(stateManager.getCombatState().turn.leveledSpellCast, false);

  stateManager.startTurn();
  stateManager.useCombatOption({
    name: "Counterspell",
    source: "spell",
    cost: { reaction: true, resource: null },
    spell: { level: 0, concentration: false }
  });

  assert.equal(stateManager.getCombatState().turn.reactionUsed, true);
  assert.equal(stateManager.getCombatState().turn.leveledSpellCast, false);
});

test("ready action creates a readied reaction until used or next turn starts", () => {
  const storage = createMemoryStorage();
  const stateManager = createStateManager({ storage, eventBus: { emit() {} } });
  const character = {
    id: "ready-hero",
    name: "Ready Hero",
    importedAt: "2026-05-19T00:00:00.000Z",
    combat: { maxHp: 10, ac: 12, speed: { walk: 30 } },
    resources: { spellSlots: {}, classResources: [], limitedUses: [] },
    inventory: { weapons: [] },
    spells: { known: [], prepared: [], cantrips: [] },
    features: { class: [], race: [], feats: [], other: [] }
  };

  stateManager.importCharacter(character);
  stateManager.useCombatOption({ id: "basic_ready", name: "Ready", cost: { action: true } });

  assert.equal(stateManager.getCombatState().turn.actionUsed, true);
  assert.equal(stateManager.getCombatState().turn.readiedAction, true);

  stateManager.endTurn();

  assert.equal(stateManager.getCombatState().turn.readiedAction, true);

  stateManager.useCombatOption({ id: "basic_use_readied_action", name: "Use Readied Action", cost: { reaction: true } });

  assert.equal(stateManager.getCombatState().turn.reactionUsed, true);
  assert.equal(stateManager.getCombatState().turn.readiedAction, false);

  stateManager.useCombatOption({ id: "basic_ready", name: "Ready", cost: { action: true } });
  stateManager.startTurn();

  assert.equal(stateManager.getCombatState().turn.readiedAction, false);
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

async function importCharacterFromPdfTextOrBuffer(path) {
  return importCharacterFromPdfBuffer(readFileSync(new URL(`../${path}`, import.meta.url)), { sourceName: path.split("/").pop() });
}

function baseCombatState() {
  return {
    turn: { actionUsed: false, bonusActionUsed: false, reactionUsed: false, objectInteractionUsed: false, movementUsed: 0 },
    current: { conditions: [] },
    resourcesUsed: { spellSlots: {}, classResources: {} }
  };
}

function minimalReferenceData() {
  return { indexes: { featureActionIndexByName: new Map() } };
}

function realReferenceData() {
  const data = {
    classes: readJson("data/classes.json"),
    feats: readJson("data/feats.json"),
    races: readJson("data/races.json")
  };
  return { data, ...transformCombatData(data) };
}

function featureSpellReferenceData() {
  return {
    indexes: {
      featureActionIndexByName: new Map(),
      spellIndexByName: new Map([
        ["feather fall", {
          name: "Feather Fall",
          level: 1,
          casting_time: "1 reaction",
          range: "60 feet",
          duration: "1 minute",
          description: "Choose up to five falling creatures within range."
        }],
        ["levitate", {
          name: "Levitate",
          level: 2,
          casting_time: "1 action",
          range: "60 feet",
          duration: "Concentration, up to 10 minutes",
          description: "One creature or object must make a Constitution saving throw."
        }]
      ])
    }
  };
}

function readJson(path) {
  return JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8").replace(/^\uFEFF/, ""));
}

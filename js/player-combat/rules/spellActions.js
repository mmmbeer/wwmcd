import { findByName } from "../data/referenceDataService.js";
import { normalizeName } from "../data/combatDataTransformer.js";

export function getSpellActions(character, combatState, referenceData) {
  const spells = uniqueSpells([
    ...(character?.spells?.prepared ?? []),
    ...(character?.spells?.known ?? []),
    ...(character?.spells?.cantrips ?? [])
  ]);

  return spells.slice(0, 40).map((spell, index) => {
    const reference = findByName(referenceData?.indexes?.spellIndexByName ?? new Map(), spell.name) ?? {};
    return createSpellOption(character, combatState, spell, reference, index);
  });
}

function createSpellOption(character, combatState, spell, reference, index) {
  const level = normalizeSpellLevel(spell.level ?? reference.level);
  const castingTime = String(reference.casting_time ?? spell.castingTime ?? spell.activation?.activationType ?? "1 action");
  const cost = costFromCastingTime(castingTime);
  const description = String(reference.description ?? spell.description ?? "");
  const attackBonus = spellAttackBonus(character);
  const roll = spellRoll(character, description, attackBonus);
  const slotReason = slotUnavailableReason(character, combatState, level);
  const concentration = /concentration/i.test(String(reference.duration ?? description));

  return {
    id: `spell_${normalizeName(spell.name).replace(/[^a-z0-9]+/g, "_") || index}`,
    name: spell.name ?? "Spell",
    description: [
      level === 0 ? "Cantrip" : `Level ${level}`,
      reference.range ? `Range ${reference.range}` : null,
      concentration ? "Concentration" : null
    ].filter(Boolean).join(" - "),
    source: "spell",
    group: cost.bonus ? "bonus" : cost.reaction ? "reaction" : "action",
    tags: ["spell", level === 0 ? "cantrip" : "slot"],
    cost: { ...cost, resource: level > 0 ? { type: "spellSlot", level } : null },
    resource: level > 0 ? `Level ${level} spell slot` : null,
    recommended: index < 2,
    rolls: roll ? [roll] : [],
    unavailableReasons: slotReason ? [slotReason] : [],
    meta: [
      castingTime,
      reference.duration ? `Duration ${reference.duration}` : null,
      slotReason ? "No slot available" : null
    ].filter(Boolean),
    spell: {
      level,
      concentration
    }
  };
}

function costFromCastingTime(castingTime) {
  const value = castingTime.toLowerCase();
  if (value.includes("bonus action")) return { bonus: true };
  if (value.includes("reaction")) return { reaction: true };
  if (value.includes("action")) return { action: true };
  return {};
}

function spellRoll(character, description, attackBonus) {
  const damage = firstFormulaNear(description, /(takes?|deals?)\s+(\d+d\d+)/i);
  const healing = firstFormulaNear(description, /(regains? hit points equal to|restore)\s+(\d+d\d+)/i);

  if (/spell attack/i.test(description)) {
    return { id: "spellAttack", label: "Roll Attack", formula: `1d20${signed(attackBonus)}`, type: "attack" };
  }

  if (healing) {
    return { id: "healing", label: "Roll Healing", formula: addCastingMod(character, description, healing), type: "healing" };
  }

  if (damage) {
    return { id: "damage", label: "Roll Damage", formula: damage, type: "damage" };
  }

  return null;
}

function firstFormulaNear(description, pattern) {
  const match = description.match(pattern);
  return match?.[2] ?? null;
}

function addCastingMod(character, description, formula) {
  if (!/spellcasting ability modifier/i.test(description)) return formula;
  return `${formula}${signed(spellAbilityModifier(character))}`;
}

function slotUnavailableReason(character, combatState, level) {
  if (level === 0) return null;
  const max = Number(character?.resources?.spellSlots?.[level] ?? 0);
  const used = Number(combatState?.resourcesUsed?.spellSlots?.[level] ?? 0);
  if (!max) return `No level ${level} spell slots found.`;
  return used >= max ? `Level ${level} spell slots are spent.` : null;
}

function spellAttackBonus(character) {
  return spellAbilityModifier(character) + Number(character?.combat?.proficiencyBonus ?? 2);
}

function spellAbilityModifier(character) {
  const classNames = (character?.classes ?? []).map((entry) => String(entry.name).toLowerCase()).join(" ");
  const ability = /wizard|artificer/.test(classNames) ? "int"
    : /bard|paladin|sorcerer|warlock/.test(classNames) ? "cha"
      : "wis";
  return Math.floor((Number(character?.stats?.[ability] ?? 10) - 10) / 2);
}

function normalizeSpellLevel(level) {
  if (String(level).toLowerCase() === "cantrip") return 0;
  const numeric = Number(level);
  return Number.isFinite(numeric) ? numeric : 0;
}

function uniqueSpells(spells) {
  const seen = new Set();
  return spells.filter((spell) => {
    const key = normalizeName(spell?.name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function signed(value) {
  return value >= 0 ? `+${value}` : String(value);
}

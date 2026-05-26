import { findByName } from "../data/referenceDataService.js";
import { normalizeName } from "../data/combatDataTransformer.js";
import { applySpellFeatureRiders } from "./spellFeatureRiders.js";

const DAMAGE_TYPES = ["acid", "cold", "fire", "force", "lightning", "necrotic", "poison", "psychic", "radiant", "thunder"];

export function getSpellActions(character, combatState, referenceData) {
  const spells = uniqueSpells([
    ...(character?.spells?.prepared ?? []),
    ...(character?.spells?.known ?? []),
    ...(character?.spells?.cantrips ?? [])
  ]);

  return spells.map((spell, index) => {
    const reference = findByName(referenceData?.indexes?.spellIndexByName ?? new Map(), spell.name) ?? {};
    return createSpellOption(character, combatState, referenceData, spell, reference, index);
  });
}

function createSpellOption(character, combatState, referenceData, spell, reference, index) {
  const level = normalizeSpellLevel(spell.level ?? reference.level);
  const castingTime = normalizeCastingTime(spell.castingTime ?? reference.casting_time ?? spell.activation ?? spell.activationType ?? "1 action");
  const cost = costFromCastingTime(castingTime);
  const importedDescription = normalizeDescription(spell.description);
  const referenceDescription = normalizeDescription(reference.description);
  const description = referenceDescription || importedDescription;
  const attackBonus = spell.attackBonus ?? character?.spells?.attackBonus ?? spellAttackBonus(character);
  const saveDc = spell.saveDc ?? character?.spells?.saveDc ?? null;
  const rollCount = spellAttackCount(character, spell, description);
  const rolls = spellRolls(character, spell, description, attackBonus, level);
  const slotReason = slotUnavailableReason(character, combatState, level);
  const range = spell.range || reference.range;
  const rangeInfo = normalizeSpellRange(range, description);
  const duration = spell.duration || reference.duration;
  const concentration = Boolean(spell.concentration) || /concentration/i.test(String(duration ?? description));
  const save = saveText(spell, description, saveDc);
  const isAttackSpell = rolls.some((roll) => roll.type === "attack");
  const damageTypes = damageTypesFromRolls(rolls, description);
  const tactics = reference.tactics ?? spell.tactics ?? null;

  const option = {
    id: `spell_${normalizeName(spell.name).replace(/[^a-z0-9]+/g, "_") || index}`,
    name: spell.name ?? "Spell",
    description: [
      level === 0 ? "Cantrip" : `Level ${level}`,
      range ? `Range ${range}` : null,
      concentration ? "Concentration" : null
    ].filter(Boolean).join(" - "),
    source: "spell",
    group: cost.bonus ? "bonus" : cost.reaction ? "reaction" : "action",
    tags: ["spell", level === 0 ? "cantrip" : "slot", isAttackSpell ? "attack" : null, rangeInfo?.type].filter(Boolean),
    cost: { ...cost, resource: level > 0 ? { type: "spellSlot", level } : null },
    resource: level > 0 ? `Level ${level} spell slot` : null,
    attack: isAttackSpell ? { count: rollCount, consumesAttackAction: false } : null,
    range: rangeInfo,
    tactics,
    recommended: index < 2,
    rolls,
    damageTypes,
    rollCount: rollCount > 1 ? rollCount : undefined,
    unavailableReasons: slotReason ? [slotReason] : [],
    meta: [
      castingTime,
      duration ? `Duration ${duration}` : null,
      save,
      rolls.some((roll) => roll.type === "attack") ? `${signed(attackBonus)} spell attack` : null,
      rollCount > 1 ? `Count: ${rollCount}` : null,
      slotReason
    ].filter(Boolean),
    spell: {
      level,
      concentration,
      castingTime,
      castingCost: castingCostName(cost),
      range,
      saveDc,
      saveAbility: spell.saveAbility ?? inferSaveAbility(description),
      reference: {
        name: reference.name ?? spell.name,
        type: reference.type,
        level,
        casting_time: reference.casting_time ?? castingTime,
        range,
        components: reference.components,
        duration,
        description,
        higher_levels: reference.higher_levels ?? spell.higher_levels,
        tactics
      }
    }
  };
  return applySpellFeatureRiders(option, { character, combatState, referenceData });
}

function normalizeDescription(value) {
  if (Array.isArray(value)) return value.map(normalizeDescription).filter(Boolean).join("\n\n");
  if (value && typeof value === "object") return normalizeDescription(value.content ?? value.description ?? value.text ?? "");
  return String(value ?? "");
}

function normalizeCastingTime(value) {
  if (value && typeof value === "object") {
    return normalizeActivationType(value.activationType)
      ?? normalizeActivationType(value.activationTime)
      ?? normalizeActivationType(value.type)
      ?? normalizeActivationType(value.id)
      ?? normalizeActivationType(value.value)
      ?? normalizeActivationType(value.unit)
      ?? normalizeActivationType(value.name)
      ?? normalizeActivationType(value.label)
      ?? normalizeActivationType(value.cost)
      ?? value.name
      ?? value.label
      ?? "1 action";
  }
  return normalizeActivationType(value) ?? String(value ?? "1 action");
}

function normalizeActivationType(value) {
  if (value && typeof value === "object") {
    return normalizeActivationType(value.activationType)
      ?? normalizeActivationType(value.activationTime)
      ?? normalizeActivationType(value.type)
      ?? normalizeActivationType(value.id)
      ?? normalizeActivationType(value.value)
      ?? normalizeActivationType(value.unit)
      ?? normalizeActivationType(value.name)
      ?? normalizeActivationType(value.label)
      ?? normalizeActivationType(value.cost);
  }

  const numeric = Number(value);
  if (numeric === 1) return "1 action";
  if (numeric === 2) return "1 bonus action";
  if (numeric === 3 || numeric === 4) return "1 reaction";

  const text = String(value ?? "").toLowerCase();
  if (!text) return null;
  if (/^\s*\d+\s*a(?:\b|\s*\+)/i.test(text)) return "1 action";
  if (/^\s*\d+\s*ba(?:\b|\s*\+)/i.test(text)) return "1 bonus action";
  if (/^\s*\d+\s*r(?:\b|\s*\+)/i.test(text)) return "1 reaction";
  if (/\bbonus(?:\s+action)?\b/.test(text)) return "1 bonus action";
  if (/\breaction\b/.test(text)) return "1 reaction";
  if (/\baction\b/.test(text)) return "1 action";
  if (text === "action") return "1 action";
  if (text === "bonus" || text === "bonus action") return "1 bonus action";
  if (text === "reaction") return "1 reaction";
  return null;
}

function costFromCastingTime(castingTime) {
  const value = String(castingTime ?? "").toLowerCase();
  if (/\bbonus(?:\s+action)?\b/.test(value)) return { bonus: true };
  if (/\breaction\b/.test(value)) return { reaction: true };
  if (/\baction\b/.test(value)) return { action: true };
  return {};
}

function castingCostName(cost) {
  if (cost.bonus) return "bonus";
  if (cost.reaction) return "reaction";
  if (cost.action) return "action";
  return "special";
}

function spellRolls(character, spell, description, attackBonus, spellLevel) {
  const damage = formulaFromDamage(spell.damage) ?? firstFormulaNear(description, /(takes?|deals?|take|deal)\s+(\d+d\d+)/i);
  const healing = firstFormulaNear(description, /(regains? hit points equal to|regains?|restore|heals?)\s+(\d+d\d+)/i);
  const scaledDamage = scaleCantripDamage(damage, characterLevel(character), spellLevel, description);

  if (spell.attackType || (spell.attackBonus !== null && spell.attackBonus !== undefined) || /spell attack/i.test(description)) {
    return [
      { id: "spellAttack", label: "Roll Attack", formula: `1d20${signed(attackBonus)}`, type: "attack" },
      scaledDamage ? { id: "damage", label: "Roll Damage", formula: scaledDamage, type: "damage", damageType: damageTypeFrom(spell.damage) || damageTypeFromText(description) } : null
    ].filter(Boolean);
  }

  if (healing) {
    return [{ id: "healing", label: "Roll Healing", formula: addCastingMod(character, description, healing), type: "healing" }];
  }

  if (damage) {
    return [{ id: "damage", label: "Roll Damage", formula: scaledDamage, type: "damage", damageType: damageTypeFrom(spell.damage) || damageTypeFromText(description) }];
  }

  return [];
}

function spellAttackCount(character, spell, description) {
  const explicit = Number(spell.attackCount ?? 0);
  if (explicit > 0) return explicit;
  const level = characterLevel(character);
  if (/\bmore than one beam\b|\btwo beams at (?:level|5th level)|make a separate attack roll for each beam/i.test(description)) {
    if (level >= 17) return 4;
    if (level >= 11) return 3;
    if (level >= 5) return 2;
  }
  return 1;
}

function normalizeSpellRange(range, description) {
  const text = String(range ?? "");
  if (!text) return null;
  const lower = text.toLowerCase();
  if (/\btouch\b/.test(lower)) return { type: "melee", label: "Touch", normal: 5, long: null };
  if (/\bself\b/.test(lower)) return { type: "self", label: text, normal: 0, long: null };
  const feet = Number(text.match(/(\d+)\s*(?:feet|foot|ft\.?)/i)?.[1] ?? 0);
  const type = /ranged spell attack/i.test(description) || feet > 5 ? "ranged" : "melee";
  return {
    type,
    label: text.replace(/\bfeet\b/i, "ft.").trim(),
    normal: feet || null,
    long: null
  };
}

function scaleCantripDamage(formula, characterLevelValue, spellLevel, description) {
  if (!formula || Number(spellLevel) !== 0 || !hasCantripScaling(description)) return formula;
  if (/\bmore than one beam\b|\bmake a separate attack roll for each beam\b/i.test(description)) return formula;
  const tier = characterLevelValue >= 17 ? 4 : characterLevelValue >= 11 ? 3 : characterLevelValue >= 5 ? 2 : 1;
  return String(formula).replace(/^(\d*)d(\d+)/i, (match, countText, sides) => {
    const count = Number(countText || 1);
    return count >= tier ? match : `${count * tier}d${sides}`;
  });
}

function hasCantripScaling(description) {
  return /\b(?:cantrip upgrade|higher levels?|5th level|level 5|11th level|level 11|17th level|level 17)\b/i.test(description);
}

function characterLevel(character) {
  const explicit = Number(character?.level ?? 0);
  if (explicit > 0) return explicit;
  return (character?.classes ?? []).reduce((total, entry) => total + Number(entry?.level ?? 0), 0) || 1;
}

function damageTypesFromRolls(rolls, description) {
  return [...new Set([
    ...rolls.map((roll) => roll.damageType).filter(Boolean),
    damageTypeFromText(description)
  ].filter(Boolean).map((type) => String(type).toLowerCase()))];
}

function firstFormulaNear(description, pattern) {
  const match = description.match(pattern);
  return match?.[2] ?? null;
}

function formulaFromDamage(damage) {
  if (!damage) return null;
  if (typeof damage === "string") return damage.match(/\d+d\d+/i)?.[0] ?? null;
  return damage.diceString ?? damage.dice?.diceString ?? damage.dice ?? null;
}

function damageTypeFrom(damage) {
  if (!damage || typeof damage === "string") return "";
  return damage.type ?? damage.damageType ?? "";
}

function damageTypeFromText(text) {
  return DAMAGE_TYPES.find((type) => new RegExp(`\\b${type}\\b`, "i").test(text)) ?? "";
}

function addCastingMod(character, description, formula) {
  if (!/spellcasting ability modifier/i.test(description)) return formula;
  return `${formula}${signed(spellAbilityModifier(character))}`;
}

function slotUnavailableReason(character, combatState, level) {
  if (level === 0) return null;
  const slots = character?.resources?.spellSlots ?? {};
  const max = spellSlotMax(slots[level]);
  const used = Number(combatState?.resourcesUsed?.spellSlots?.[level] ?? 0);
  if (!Object.keys(slots).length) return "Spell slots were not imported.";
  if (!max) return `No level ${level} spell slots found.`;
  return used >= max ? `Level ${level} spell slots are spent.` : null;
}

function spellSlotMax(value) {
  if (value && typeof value === "object") return Number(value.available ?? value.max ?? value.value ?? 0);
  return Number(value ?? 0);
}

function spellAttackBonus(character) {
  return spellAbilityModifier(character) + Number(character?.combat?.proficiencyBonus ?? 2);
}

function spellAbilityModifier(character) {
  const explicit = character?.spells?.spellcastingAbility;
  if (explicit) return Math.floor((Number(character?.stats?.[explicit] ?? 10) - 10) / 2);
  const classNames = (character?.classes ?? []).map((entry) => String(entry.name).toLowerCase()).join(" ");
  const ability = /wizard|artificer/.test(classNames) ? "int"
    : /bard|paladin|sorcerer|warlock/.test(classNames) ? "cha"
      : "wis";
  return Math.floor((Number(character?.stats?.[ability] ?? 10) - 10) / 2);
}

function saveText(spell, description, saveDc) {
  const ability = spell.saveAbility ?? inferSaveAbility(description);
  if (!ability) return null;
  return `${ability.toUpperCase()} save${saveDc ? ` DC ${saveDc}` : ""}`;
}

function inferSaveAbility(description) {
  const match = description.match(/\b(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+saving throw/i);
  return match ? match[1].slice(0, 3).toLowerCase() : null;
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

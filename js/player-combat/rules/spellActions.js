import { findByName } from "../data/referenceDataService.js";
import { normalizeName } from "../data/combatDataTransformer.js";
import { applySpellFeatureRiders } from "./spellFeatureRiders.js";

export function getSpellActions(character, combatState, referenceData) {
  const spells = uniqueSpells([
    ...(character?.spells?.prepared ?? []),
    ...(character?.spells?.known ?? []),
    ...(character?.spells?.cantrips ?? [])
  ]);

  return spells.slice(0, 40).map((spell, index) => {
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
  const roll = spellRoll(character, spell, description, attackBonus);
  const slotReason = slotUnavailableReason(character, combatState, level);
  const range = spell.range || reference.range;
  const duration = spell.duration || reference.duration;
  const concentration = Boolean(spell.concentration) || /concentration/i.test(String(duration ?? description));
  const save = saveText(spell, description, saveDc);

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
    tags: ["spell", level === 0 ? "cantrip" : "slot"],
    cost: { ...cost, resource: level > 0 ? { type: "spellSlot", level } : null },
    resource: level > 0 ? `Level ${level} spell slot` : null,
    recommended: index < 2,
    rolls: roll ? [roll] : [],
    unavailableReasons: slotReason ? [slotReason] : [],
    meta: [
      castingTime,
      duration ? `Duration ${duration}` : null,
      save,
      roll?.type === "attack" ? `${signed(attackBonus)} spell attack` : null,
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
        higher_levels: reference.higher_levels ?? spell.higher_levels
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

function spellRoll(character, spell, description, attackBonus) {
  const damage = formulaFromDamage(spell.damage) ?? firstFormulaNear(description, /(takes?|deals?|take|deal)\s+(\d+d\d+)/i);
  const healing = firstFormulaNear(description, /(regains? hit points equal to|regains?|restore|heals?)\s+(\d+d\d+)/i);

  if (spell.attackType || /spell attack/i.test(description)) {
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

function formulaFromDamage(damage) {
  if (!damage) return null;
  if (typeof damage === "string") return damage.match(/\d+d\d+/i)?.[0] ?? null;
  return damage.diceString ?? damage.dice?.diceString ?? damage.dice ?? null;
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

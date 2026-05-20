import { findByName } from "../data/referenceDataService.js";
import { hasFeature } from "./featureRuleHelpers.js";

export function applySpellFeatureRiders(option, context) {
  if (!hasFeature(context.character, "War Caster", context.referenceData)) return option;
  if (!isWarCasterOpportunitySpell(option)) return option;
  return {
    ...option,
    meta: [...(option.meta ?? []), "War Caster: eligible for opportunity spell reaction"],
    riders: [
      ...(option.riders ?? []),
      { id: "war_caster_opportunity", name: "War Caster Opportunity Spell" }
    ]
  };
}

export function getWarCasterOpportunitySpellNames(character, referenceData) {
  if (!hasFeature(character, "War Caster", referenceData)) return [];
  const spellIndex = referenceData?.indexes?.spellIndexByName ?? new Map();
  return uniqueSpells([
    ...(character?.spells?.prepared ?? []),
    ...(character?.spells?.known ?? []),
    ...(character?.spells?.cantrips ?? [])
  ])
    .map((spell) => {
      const reference = findByName(spellIndex, spell.name) ?? {};
      return {
        name: spell.name,
        castingTime: spell.castingTime ?? reference.casting_time ?? spell.activation ?? spell.activationType,
        range: spell.range ?? reference.range,
        description: String(spell.description ?? reference.description ?? "")
      };
    })
    .filter((spell) => hasActionCastingTime(spell.castingTime) && isSingleTargetSpell(spell))
    .map((spell) => spell.name)
    .slice(0, 6);
}

function isWarCasterOpportunitySpell(option) {
  return option.source === "spell"
    && option.cost?.action
    && isSingleTargetSpell({
      name: option.name,
      range: option.spell?.range,
      description: option.spell?.reference?.description ?? ""
    });
}

function isSingleTargetSpell(spell) {
  const text = `${spell.name ?? ""} ${spell.range ?? ""} ${spell.description ?? ""}`.toLowerCase();
  if (/\bself\b/.test(String(spell.range ?? "").toLowerCase())) return false;
  if (/\b(cone|cube|cylinder|emanation|line|radius|sphere|square|wall)\b/.test(text)) return false;
  if (/\b(each|all|any number of|creatures? of your choice|up to \w+ creatures?|targets?)\b/.test(text)) return false;
  return /\b(one|a|an|the) (creature|target)\b/.test(text) || /\bspell attack\b/.test(text);
}

function hasActionCastingTime(value) {
  const text = String(value ?? "1 action").toLowerCase();
  const numeric = Number(value);
  if (numeric === 1) return true;
  return /\baction\b/.test(text) && !/\bbonus\b|\breaction\b/.test(text);
}

function uniqueSpells(spells) {
  const seen = new Set();
  return spells.filter((spell) => {
    const key = String(spell?.name ?? "").trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

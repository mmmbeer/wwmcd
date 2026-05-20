import { normalizeName } from "../data/combatDataTransformer.js";
import { collectCharacterFeatures } from "./featureData.js";

export function hasFeature(character, name, referenceData = null) {
  const target = normalizeName(name);
  return collectCharacterFeatures(character, referenceData).some((feature) => normalizeName(feature.name) === target);
}

export function hasFeatureMatching(character, pattern, referenceData = null) {
  return collectCharacterFeatures(character, referenceData).some((feature) => pattern.test(feature.name));
}

export function classLevel(character, className) {
  const pattern = new RegExp(`\\b${escapeRegExp(className)}\\b`, "i");
  return (character?.classes ?? [])
    .filter((entry) => pattern.test(entry.name))
    .reduce((sum, entry) => sum + Number(entry.level ?? 0), 0);
}

export function hasSubclass(character, pattern) {
  return (character?.classes ?? []).some((entry) => pattern.test(String(entry.subclass ?? "")));
}

export function abilityModifier(character, ability) {
  return Math.floor((Number(character?.stats?.[ability] ?? 10) - 10) / 2);
}

export function findClassResource(character, pattern) {
  return [
    ...(character?.resources?.classResources ?? []),
    ...(character?.resources?.limitedUses ?? [])
  ].find((resource) => pattern.test(resource.name));
}

export function bestAvailableSpellSlot(character, combatState) {
  const slots = character?.resources?.spellSlots ?? {};
  return Object.keys(slots)
    .map(Number)
    .filter((level) => level > 0 && spellSlotsRemaining(character, combatState, level) > 0)
    .sort((a, b) => a - b)[0] ?? null;
}

export function spellSlotsRemaining(character, combatState, level) {
  const max = spellSlotMax(character?.resources?.spellSlots?.[level]);
  const used = Number(combatState?.resourcesUsed?.spellSlots?.[level] ?? 0);
  return Math.max(0, max - used);
}

export function signed(value) {
  return value >= 0 ? `+${value}` : String(value);
}

function spellSlotMax(value) {
  if (value && typeof value === "object") return Number(value.available ?? value.max ?? value.value ?? 0);
  return Number(value ?? 0);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

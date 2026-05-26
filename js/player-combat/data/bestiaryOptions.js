import { normalizeName } from "./combatDataTransformer.js";

export function getBestiaryOptions(referenceData) {
  const monsters = referenceData?.data?.["bestiary-mm"]?.monster;
  if (!Array.isArray(monsters)) return [];
  return monsters
    .filter((creature) => creature?.name)
    .map((creature, index) => ({
      id: `${normalizeName(creature.name)}-${creature.source ?? "MM"}-${creature.page ?? index}`,
      name: creature.name,
      source: creature.source ?? "MM",
      page: creature.page ?? null,
      creature
    }))
    .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
}

export function findBestiaryOptionByName(options, name) {
  const normalized = normalizeName(name);
  if (!normalized) return null;
  return options.find((option) => normalizeName(option.name) === normalized) ?? null;
}

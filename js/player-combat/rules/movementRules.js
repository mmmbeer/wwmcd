import { hasFeature } from "./featureRuleHelpers.js";

export function getEffectiveWalkSpeed(character, referenceData) {
  const base = Number(character?.combat?.speed?.walk ?? raceBaseSpeed(character));
  return Math.max(0, base + speedBonus(character, referenceData));
}

function speedBonus(character, referenceData) {
  let bonus = 0;
  if (hasFeature(character, "Fast Movement", referenceData) && !wearsHeavyArmor(character)) bonus += 10;
  if (hasFeature(character, "Unarmored Movement", referenceData) && !wearsArmorOrShield(character)) {
    bonus += monkUnarmoredMovementBonus(character);
  }
  if (hasFeature(character, "Mobile", referenceData)) bonus += 10;
  if (hasFeature(character, "Squat Nimbleness", referenceData)) bonus += 5;
  if (hasFeature(character, "Fleet of Foot", referenceData)) bonus += Math.max(0, 35 - baseRaceSpeed(character));
  return bonus;
}

function raceBaseSpeed(character) {
  const race = String(character?.race?.name ?? "");
  if (/dwarf|gnome|halfling/i.test(race)) return 25;
  if (/wood elf/i.test(race)) return 35;
  return 30;
}

function baseRaceSpeed(character) {
  return raceBaseSpeed(character);
}

function monkUnarmoredMovementBonus(character) {
  const level = (character?.classes ?? [])
    .filter((entry) => /monk/i.test(entry.name))
    .reduce((sum, entry) => sum + Number(entry.level ?? 0), 0);
  if (level >= 18) return 30;
  if (level >= 14) return 25;
  if (level >= 10) return 20;
  if (level >= 6) return 15;
  if (level >= 2) return 10;
  return 0;
}

function wearsArmorOrShield(character) {
  return (character?.inventory?.armor ?? []).some((item) => item.equipped !== false);
}

function wearsHeavyArmor(character) {
  return (character?.inventory?.armor ?? []).some((item) => (
    item.equipped !== false && /heavy/i.test(`${item.type} ${item.category} ${item.name}`)
  ));
}

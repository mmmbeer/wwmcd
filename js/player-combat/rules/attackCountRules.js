import { collectCharacterFeatures, featureText } from "./featureData.js";

export function getAttackCount(character, referenceData) {
  return getAttackCountFromFeatures(character, referenceData);
}

export function getAttackCountFromFeatures(character, referenceData) {
  return collectCharacterFeatures(character, referenceData)
    .filter((entry) => /^extra attack\b/i.test(entry.name))
    .reduce((count, entry) => Math.max(count, attacksFromFeature(entry)), 1);
}

function attacksFromFeature(entry) {
  const text = featureText(entry);
  if (/\bfour times\b|\bfour attacks\b|\battack four\b/i.test(text) || /\(3\)/.test(entry.name)) return 4;
  if (/\bthree times\b|\bthree attacks\b|\battack three\b/i.test(text) || /\(2\)/.test(entry.name)) return 3;
  if (/\btwice\b|\btwo attacks\b|\battack two\b/i.test(text) || /^extra attack\b/i.test(entry.name)) return 2;
  return 1;
}

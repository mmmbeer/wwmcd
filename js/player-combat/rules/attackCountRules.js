export function getAttackCount(character) {
  const fighterLevel = classLevel(character, "fighter");
  if (fighterLevel >= 20) return 4;
  if (fighterLevel >= 11) return 3;
  if (hasExtraAttack(character)) return 2;
  return 1;
}

function hasExtraAttack(character) {
  return featureNames(character).some((name) => /^extra attack\b/i.test(name));
}

function featureNames(character) {
  return [
    ...(character?.features?.class ?? []),
    ...(character?.features?.other ?? []),
    ...(character?.classes ?? []).flatMap((entry) => entry.features ?? [])
  ].map((feature) => String(feature?.name ?? feature ?? ""));
}

function classLevel(character, className) {
  return (character?.classes ?? [])
    .filter((entry) => String(entry.name ?? "").toLowerCase() === className)
    .reduce((total, entry) => total + Number(entry.level ?? 0), 0);
}

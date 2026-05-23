export function isAttackActionOption(option) {
  if (!option?.cost?.action) return false;
  if (option.attack?.consumesAttackAction) return true;
  if (option.source === "spell" || option.tags?.includes("spell")) return false;
  return option.source === "weapon"
    || option.tags?.includes("weapon")
    || option.tags?.includes("unarmed")
    || option.tags?.includes("special");
}

export function isWeaponAttackOption(option) {
  return isAttackActionOption(option)
    && (option.source === "weapon" || option.tags?.includes("weapon") || option.tags?.includes("unarmed"));
}

export function attackCapacity(option) {
  return Math.max(1, Number(option?.attack?.count ?? 1));
}

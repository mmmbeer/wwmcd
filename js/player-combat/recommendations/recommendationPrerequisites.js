const ATTACK_ACTION_REQUIRED = /\b(?:after|when|if)\s+(?:you\s+)?(?:take|took|taking|use|used|using)\s+the\s+attack\s+action\b|\brequires taking the attack action\b|\bafter\s+(?:you\s+)?attack(?:ing)?\b/i;
const NAMED_HIT_RIDERS = /\b(?:divine smite|eldritch smite|sneak attack|stunning strike)\b/i;
const HIT_REQUIRED = /\b(?:after|when|if)\s+(?:you\s+)?(?:hit|hits)\b|\bafter\s+(?:a|an|the)?\s*(?:melee |ranged |weapon )*(?:attack |weapon )?hit\b|\bon hit\b|\buse after (?:a|an|the)?\s*(?:melee |ranged |weapon )*(?:attack |weapon )?hit\b/i;
const WEAPON_HIT_REQUIRED = /\b(?:melee|ranged|weapon|finesse)\b.{0,60}\bhit\b|\bhit\b.{0,60}\b(?:melee|ranged|weapon|finesse)\b/i;
const UNCERTAIN_TRIGGER_REQUIRED = /\bcritical hit\b|\breduc(?:e|ing)\s+(?:a\s+)?creature\s+to\s+0\s+(?:hit points|hp)\b|\bwhen a creature enters your reach\b|\bwhen .* leaves your reach\b/i;

export function prerequisiteKind(option) {
  const text = optionText(option);
  if (UNCERTAIN_TRIGGER_REQUIRED.test(text)) return "trigger";
  if (NAMED_HIT_RIDERS.test(option.name)) return "weaponHit";
  if (HIT_REQUIRED.test(text)) return WEAPON_HIT_REQUIRED.test(text) ? "weaponHit" : "hit";
  if (ATTACK_ACTION_REQUIRED.test(text)) return "attackAction";
  return null;
}

export function canPairAfterPrimary(option, primary) {
  const kind = prerequisiteKind(option);
  if (!kind) return true;
  if (kind === "trigger") return false;
  if (kind === "attackAction") return isAttackAction(primary);
  if (kind === "hit") return isAttackAction(primary);
  if (kind === "weaponHit") return isWeaponAttackAction(primary);
  return true;
}

export function isDependentOption(option) {
  return Boolean(prerequisiteKind(option));
}

export function isAttackAction(option) {
  return Boolean(option?.cost?.action)
    && (option.tags?.includes("attack") || option.rolls?.some((roll) => roll.type === "attack" || roll.id === "attack"));
}

function isWeaponAttackAction(option) {
  return isAttackAction(option)
    && (option.source === "weapon" || option.tags?.includes("weapon") || option.tags?.includes("unarmed"));
}

function optionText(option) {
  return [
    option.name,
    option.description,
    option.longDescription,
    option.featureAction?.description,
    ...(option.meta ?? []),
    ...(option.tags ?? [])
  ].filter(Boolean).join(" ");
}

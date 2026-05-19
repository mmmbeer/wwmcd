import { collectCharacterFeatures } from "./featureData.js";

export function getMonkActions(character, combatState) {
  if (!isMonk(character) && !hasMonkFeature(character)) return [];

  return [
    martialArtsOption(character, combatState),
    flurryOfBlowsOption(character, combatState)
  ].filter(Boolean);
}

export function findFocusResource(character) {
  return [
    ...(character?.resources?.classResources ?? []),
    ...(character?.resources?.limitedUses ?? [])
  ].find((resource) => /\b(ki|focus|discipline)\b/i.test(resource.name));
}

function martialArtsOption(character, combatState) {
  if (!hasFeatureNamed(character, "Martial Arts") && monkLevel(character) < 1) return null;
  const actionTaken = Boolean(combatState?.turn?.attackActionUsed);
  return {
    id: "monk_martial_arts_bonus_unarmed",
    name: "Martial Arts: Unarmed Strike",
    description: "After taking the Attack action with an unarmed strike or monk weapon, make one unarmed strike as a bonus action.",
    source: "feature",
    group: "bonus",
    tags: ["feature", "monk", "attack", "unarmed"],
    cost: { bonus: true },
    recommended: actionTaken,
    rolls: [unarmedAttackRoll(character), martialArtsDamageRoll(character)],
    unavailableReasons: actionTaken ? [] : ["Requires taking the Attack action first this turn."],
    meta: ["Monk", `Martial Arts die ${martialArtsDie(character)}`]
  };
}

function flurryOfBlowsOption(character, combatState) {
  if (!hasFeatureNamed(character, "Flurry of Blows") && monkLevel(character) < 2) return null;
  const focus = findFocusResource(character);
  const actionTaken = Boolean(combatState?.turn?.attackActionUsed);
  return {
    id: "monk_flurry_of_blows",
    name: "Flurry of Blows",
    description: "After taking the Attack action, spend 1 Ki to make two unarmed strikes as a bonus action.",
    source: "feature",
    group: "bonus",
    tags: ["feature", "monk", "attack", "unarmed"],
    cost: {
      bonus: true,
      resource: focus ? { type: "classResource", id: focus.id, amount: 1, name: focus.name } : null
    },
    recommended: actionTaken && Boolean(focus),
    rolls: [unarmedAttackRoll(character), martialArtsDamageRoll(character)],
    unavailableReasons: [
      actionTaken ? null : "Requires taking the Attack action first this turn.",
      focus ? null : "No Ki or Focus resource found to spend."
    ].filter(Boolean),
    meta: ["Monk", "Spend 1 Ki", "Make two unarmed strikes"]
  };
}

function unarmedAttackRoll(character) {
  const ability = bestMonkAttackAbility(character);
  const bonus = abilityModifier(character, ability) + Number(character?.combat?.proficiencyBonus ?? 2);
  return { id: "attack", label: "Roll Attack", formula: `1d20${signed(bonus)}`, type: "attack" };
}

function martialArtsDamageRoll(character) {
  const ability = bestMonkAttackAbility(character);
  return {
    id: "damage",
    label: "Roll Damage",
    formula: `${martialArtsDie(character)}${signed(abilityModifier(character, ability))}`,
    type: "damage",
    damageType: "bludgeoning"
  };
}

function martialArtsDie(character) {
  const level = monkLevel(character);
  if (level >= 17) return "1d10";
  if (level >= 11) return "1d8";
  if (level >= 5) return "1d6";
  return "1d4";
}

function bestMonkAttackAbility(character) {
  return abilityModifier(character, "dex") > abilityModifier(character, "str") ? "dex" : "str";
}

function abilityModifier(character, ability) {
  return Math.floor((Number(character?.stats?.[ability] ?? 10) - 10) / 2);
}

function isMonk(character) {
  return monkLevel(character) > 0;
}

function monkLevel(character) {
  return (character?.classes ?? [])
    .filter((entry) => /monk/i.test(entry.name))
    .reduce((sum, entry) => sum + Number(entry.level ?? 0), 0);
}

function hasMonkFeature(character) {
  return ["Martial Arts", "Flurry of Blows", "Ki"].some((name) => hasFeatureNamed(character, name));
}

function hasFeatureNamed(character, name) {
  return collectCharacterFeatures(character, null).some((feature) => feature.name === name);
}

function signed(value) {
  return value >= 0 ? `+${value}` : String(value);
}

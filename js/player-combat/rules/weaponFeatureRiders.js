import {
  abilityModifier,
  classLevel,
  findClassResource,
  hasFeature,
  signed
} from "./featureRuleHelpers.js";

export function applyWeaponFeatureRiders(option, context) {
  const riders = [
    rageRider(context),
    recklessRider(context),
    sneakAttackRider(context),
    stunningStrikeRider(context),
    greatWeaponMasterRider(context)
  ].filter(Boolean);

  if (!riders.length) return option;

  return {
    ...option,
    rolls: [...(option.rolls ?? []), ...riders.flatMap((rider) => rider.rolls ?? [])],
    warnings: [...(option.warnings ?? []), ...riders.flatMap((rider) => rider.warnings ?? [])],
    meta: [...(option.meta ?? []), ...riders.flatMap((rider) => rider.meta ?? [])],
    riders: [...(option.riders ?? []), ...riders]
  };
}

function rageRider({ character, combatState, weaponProfile }) {
  if (!hasActiveEffect(combatState, "Rage") || !weaponProfile.melee || weaponProfile.ability !== "str") return null;
  const bonus = rageDamageBonus(classLevel(character, "Barbarian"));
  return {
    id: "rage",
    name: "Rage Damage",
    meta: [`Rage: +${bonus} damage on Strength melee hits`, "Rage: resistance to bludgeoning, piercing, and slashing damage"]
  };
}

function recklessRider({ combatState, weaponProfile }) {
  if (!combatState?.turn?.recklessAttackUsed || !weaponProfile.melee || weaponProfile.ability !== "str") return null;
  return {
    id: "reckless_attack",
    name: "Reckless Attack",
    meta: ["Reckless Attack: roll this Strength melee attack with advantage"],
    warnings: ["Reckless Attack: attacks against you have advantage until your next turn."]
  };
}

function sneakAttackRider({ character, combatState, referenceData, weaponProfile }) {
  if (!hasFeature(character, "Sneak Attack", referenceData) && classLevel(character, "Rogue") < 1) return null;
  if (!weaponProfile.finesse && !weaponProfile.ranged) return null;
  const dice = Math.max(1, Math.ceil(classLevel(character, "Rogue") / 2));
  const used = combatState?.turn?.sneakAttackUsed;
  return {
    id: "sneak_attack",
    name: "Sneak Attack",
    rolls: used ? [] : [{ id: "sneakAttackDamage", label: "Roll Sneak Attack", formula: `${dice}d6`, type: "damage" }],
    meta: [
      used ? "Sneak Attack: already used this turn" : `Sneak Attack: ${dice}d6 once per turn`,
      "Requires advantage or an ally adjacent to the target"
    ]
  };
}

function stunningStrikeRider({ character, referenceData, weaponProfile }) {
  if (!hasFeature(character, "Stunning Strike", referenceData) && classLevel(character, "Monk") < 5) return null;
  if (!weaponProfile.melee && !weaponProfile.unarmed) return null;
  const focus = findClassResource(character, /\b(ki|focus|discipline)\b/i);
  const dc = 8 + Number(character?.combat?.proficiencyBonus ?? 2) + abilityModifier(character, "wis");
  return {
    id: "stunning_strike",
    name: "Stunning Strike",
    meta: [
      focus ? `Stunning Strike: spend 1 ${focus.name} on hit` : "Stunning Strike: Ki/Focus resource not tracked",
      `Target makes CON save DC ${dc}`
    ]
  };
}

function greatWeaponMasterRider({ character, referenceData, weaponProfile }) {
  if (!hasFeature(character, "Great Weapon Master", referenceData) || !weaponProfile.heavy) return null;
  const attackBonus = weaponProfile.attackBonus - 5;
  return {
    id: "great_weapon_master",
    name: "Great Weapon Master",
    rolls: [
      { id: "gwmAttack", label: "Roll GWM Attack", formula: `1d20${signed(attackBonus)}`, type: "attack" },
      { id: "gwmDamageBonus", label: "GWM Damage Bonus", formula: "10", type: "damage" }
    ],
    meta: ["Great Weapon Master: optional -5 attack / +10 damage mode"]
  };
}

function hasActiveEffect(combatState, name) {
  return (combatState?.current?.activeEffects ?? []).includes(name);
}

function rageDamageBonus(level) {
  if (level >= 16) return 4;
  if (level >= 9) return 3;
  return 2;
}

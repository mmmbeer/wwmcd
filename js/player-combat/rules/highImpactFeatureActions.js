import {
  abilityModifier,
  bestAvailableSpellSlot,
  classLevel,
  findClassResource,
  hasFeature,
  hasSubclass,
  signed
} from "./featureRuleHelpers.js";

export function getHighImpactFeatureActions(character, combatState, referenceData) {
  return [
    actionSurge(character, combatState, referenceData),
    wildShape(character, referenceData),
    divineSmite(character, combatState, referenceData),
    patientDefense(character, referenceData),
    stepOfTheWindDash(character, referenceData),
    stepOfTheWindDisengage(character, referenceData),
    greatWeaponMasterBonusAttack(character, combatState, referenceData),
    polearmMasterBonusAttack(character, referenceData),
    shieldMasterShove(character, combatState, referenceData),
    telekineticShove(character, referenceData)
  ].filter(Boolean);
}

function actionSurge(character, combatState, referenceData) {
  if (!hasFeature(character, "Action Surge", referenceData) && classLevel(character, "Fighter") < 2) return null;
  const resource = findClassResource(character, /^action surge$/i);
  return feature("feature_action_surge", "Action Surge", "Gain one additional action on top of your regular action.", {
    group: "free",
    cost: { resource: classResourceCost(resource) },
    resource: resource ? resource.name : "Action Surge",
    tags: ["fighter", "feature"],
    effect: { actionSurge: true },
    unavailableReasons: [
      resource ? null : "Action Surge resource is not tracked.",
      combatState?.turn?.actionSurgeUsed ? "Action Surge already used this turn." : null
    ].filter(Boolean),
    meta: ["Once per short or long rest"]
  });
}

function wildShape(character, referenceData) {
  if (!hasFeature(character, "Wild Shape", referenceData) && classLevel(character, "Druid") < 2) return null;
  const moon = hasSubclass(character, /moon/i) || hasFeature(character, "Combat Wild Shape", referenceData);
  const resource = findClassResource(character, /^wild shape$/i);
  const cost = moon ? { bonus: true } : { action: true };
  return feature("feature_wild_shape", "Wild Shape", "Assume a beast form you have seen before.", {
    group: moon ? "bonus" : "action",
    cost: { ...cost, resource: classResourceCost(resource) },
    resource: resource ? resource.name : "Wild Shape",
    tags: ["druid", "feature", "shapechange"],
    effect: { wildShape: true },
    unavailableReasons: resource ? [] : ["Wild Shape resource is not tracked."],
    meta: [moon ? "Circle of the Moon: bonus action" : "Action", "Uses recover on short or long rest"]
  });
}

function divineSmite(character, combatState, referenceData) {
  if (!hasFeature(character, "Divine Smite", referenceData) && classLevel(character, "Paladin") < 2) return null;
  const level = bestAvailableSpellSlot(character, combatState);
  const dice = level ? Math.min(5, level + 1) : 2;
  return feature("feature_divine_smite", "Divine Smite", "After a melee weapon hit, spend a spell slot for radiant damage.", {
    group: "free",
    cost: { resource: level ? { type: "spellSlot", level } : null },
    resource: level ? `Level ${level} spell slot` : "Spell slot",
    tags: ["paladin", "feature", "damage", "melee"],
    rolls: [{ id: "smiteDamage", label: "Roll Smite", formula: `${dice}d8`, type: "damage", damageType: "radiant" }],
    unavailableReasons: level ? [] : ["No spell slot available for Divine Smite."],
    meta: [`${dice}d8 radiant`, "+1d8 against fiends or undead", "Use after a melee weapon hit"]
  });
}

function patientDefense(character, referenceData) {
  if (!hasFeature(character, "Patient Defense", referenceData) && classLevel(character, "Monk") < 2) return null;
  const focus = focusResource(character);
  return feature("feature_patient_defense", "Patient Defense", "Spend 1 Ki to take the Dodge action as a bonus action.", {
    group: "bonus",
    cost: { bonus: true, resource: classResourceCost(focus) },
    tags: ["monk", "feature", "dodge"],
    unavailableReasons: focus ? [] : ["No Ki or Focus resource found to spend."],
    meta: ["Spend 1 Ki", "Dodge"]
  });
}

function stepOfTheWindDash(character, referenceData) {
  return stepOfTheWind(character, referenceData, "Dash");
}

function stepOfTheWindDisengage(character, referenceData) {
  return stepOfTheWind(character, referenceData, "Disengage");
}

function stepOfTheWind(character, referenceData, grantedAction) {
  if (!hasFeature(character, "Step of the Wind", referenceData) && classLevel(character, "Monk") < 2) return null;
  const focus = focusResource(character);
  return feature(`feature_step_of_the_wind_${grantedAction.toLowerCase()}`, `Step of the Wind: ${grantedAction}`, `Spend 1 Ki to ${grantedAction} as a bonus action.`, {
    group: "bonus",
    cost: { bonus: true, resource: classResourceCost(focus) },
    tags: ["monk", "feature", grantedAction.toLowerCase()],
    unavailableReasons: focus ? [] : ["No Ki or Focus resource found to spend."],
    meta: ["Spend 1 Ki", "Jump distance doubles this turn"]
  });
}

function greatWeaponMasterBonusAttack(character, combatState, referenceData) {
  if (!hasFeature(character, "Great Weapon Master", referenceData)) return null;
  return feature("feature_gwm_bonus_attack", "Great Weapon Master: Bonus Attack", "After a melee critical hit or reducing a creature to 0 HP, make one melee weapon attack as a bonus action.", {
    group: "bonus",
    cost: { bonus: true },
    tags: ["feat", "attack", "weapon"],
    warnings: ["Use only after a melee critical hit or reducing a creature to 0 HP."],
    meta: ["Heavy weapon -5 attack / +10 damage mode is tracked as a reminder"]
  });
}

function polearmMasterBonusAttack(character, referenceData) {
  if (!hasFeature(character, "Polearm Master", referenceData)) return null;
  if (!hasPolearm(character)) return null;
  const ability = polearmAbility(character);
  const attackBonus = abilityModifier(character, ability) + Number(character?.combat?.proficiencyBonus ?? 2);
  return feature("feature_polearm_master_bonus_attack", "Polearm Master: Haft Attack", "After attacking with a qualifying polearm, make a bonus attack with the opposite end.", {
    group: "bonus",
    cost: { bonus: true },
    tags: ["feat", "attack", "weapon"],
    rolls: [
      { id: "attack", label: "Roll Attack", formula: `1d20${signed(attackBonus)}`, type: "attack" },
      { id: "damage", label: "Roll Damage", formula: `1d4${signed(abilityModifier(character, ability))}`, type: "damage", damageType: "bludgeoning" }
    ],
    meta: ["Requires glaive, halberd, quarterstaff, or spear", "Also expands opportunity attack triggers"]
  });
}

function shieldMasterShove(character, combatState, referenceData) {
  if (!hasFeature(character, "Shield Master", referenceData)) return null;
  return feature("feature_shield_master_shove", "Shield Master: Shove", "After taking the Attack action, shove a creature within 5 feet as a bonus action.", {
    group: "bonus",
    cost: { bonus: true },
    tags: ["feat", "shove"],
    rolls: [{ id: "athletics", label: "Roll Athletics", formula: `1d20${signed(abilityModifier(character, "str"))}`, type: "check" }],
    unavailableReasons: [
      hasShield(character) ? null : "Requires a shield.",
      combatState?.turn?.attackActionUsed ? null : "Requires taking the Attack action first this turn."
    ].filter(Boolean),
    meta: ["Shield bonus applies to eligible Dexterity saves"]
  });
}

function telekineticShove(character, referenceData) {
  if (!hasFeature(character, "Telekinetic", referenceData)) return null;
  const dc = 8 + Number(character?.combat?.proficiencyBonus ?? 2) + bestMentalModifier(character);
  return feature("feature_telekinetic_shove", "Telekinetic Shove", "Use a bonus action to shove one creature 5 feet toward or away from you.", {
    group: "bonus",
    cost: { bonus: true },
    tags: ["feat", "shove"],
    meta: [`STR save DC ${dc}`, "30 ft range"]
  });
}

function feature(id, name, description, extra = {}) {
  return {
    id,
    name,
    description,
    source: "feature",
    group: extra.group ?? "free",
    tags: ["feature", ...(extra.tags ?? [])],
    cost: extra.cost ?? {},
    recommended: false,
    rolls: extra.rolls ?? [],
    ...extra
  };
}

function focusResource(character) {
  return findClassResource(character, /\b(ki|focus|discipline)\b/i);
}

function classResourceCost(resource) {
  return resource ? { type: "classResource", id: resource.id, amount: 1, name: resource.name } : null;
}

function hasPolearm(character) {
  return (character?.inventory?.weapons ?? []).some((weapon) => /glaive|halberd|quarterstaff|spear/i.test(weapon.name));
}

function hasShield(character) {
  return (character?.inventory?.armor ?? []).some((item) => item.equipped !== false && /shield/i.test(`${item.name} ${item.type} ${item.category}`));
}

function polearmAbility(character) {
  return abilityModifier(character, "dex") > abilityModifier(character, "str") ? "dex" : "str";
}

function bestMentalModifier(character) {
  return Math.max(abilityModifier(character, "int"), abilityModifier(character, "wis"), abilityModifier(character, "cha"));
}

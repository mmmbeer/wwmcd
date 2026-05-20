import {
  abilityModifier,
  classLevel,
  findClassResource,
  hasFeature,
  hasSubclass,
  signed
} from "./featureRuleHelpers.js";

export function getAdvancedFeatureActions(character, combatState, referenceData) {
  return [
    rage(character, combatState, referenceData),
    endRage(character, combatState, referenceData),
    recklessAttack(character, referenceData),
    frenzyAttack(character, combatState, referenceData),
    deflectMissiles(character, referenceData),
    slowFall(character, referenceData),
    stunningStrike(character, referenceData),
    sneakAttack(character, combatState, referenceData),
    uncannyDodge(character, referenceData),
    warCasterOpportunitySpell(character, referenceData),
    greatWeaponMasterHeavyAttack(character, referenceData),
    polearmMasterOpportunityTrigger(character, referenceData),
    shieldMasterDexSave(character, referenceData)
  ].filter(Boolean);
}

function rage(character, combatState, referenceData) {
  if (!hasFeature(character, "Rage", referenceData) && classLevel(character, "Barbarian") < 1) return null;
  const active = hasActiveEffect(combatState, "Rage");
  const resource = findClassResource(character, /^rage$/i);
  return option("feature_rage", "Rage", "Enter a rage for resistance and bonus melee damage.", {
    group: "bonus",
    cost: { bonus: true, resource: classResourceCost(resource) },
    resource: resource ? resource.name : null,
    tags: ["barbarian", "feature"],
    effect: { activeEffect: "Rage" },
    unavailableReasons: active ? ["Rage is already active."] : [],
    warnings: resource ? [] : ["Rage uses are not tracked for this character."],
    meta: ["Advantage on Strength checks and saves", "Bonus melee damage while raging"]
  });
}

function endRage(character, combatState, referenceData) {
  if (!hasActiveEffect(combatState, "Rage")) return null;
  if (!hasFeature(character, "Rage", referenceData) && classLevel(character, "Barbarian") < 1) return null;
  return option("feature_end_rage", "End Rage", "End your active rage.", {
    group: "bonus",
    cost: { bonus: true },
    tags: ["barbarian", "feature"],
    effect: { clearEffect: "Rage" }
  });
}

function recklessAttack(character, referenceData) {
  if (!hasFeature(character, "Reckless Attack", referenceData) && classLevel(character, "Barbarian") < 2) return null;
  return option("feature_reckless_attack", "Reckless Attack", "Before your first attack, gain advantage on Strength melee weapon attacks this turn.", {
    group: "free",
    tags: ["barbarian", "feature", "attack"],
    effect: { turnFlag: "recklessAttackUsed" },
    meta: ["Attacks against you have advantage until your next turn"]
  });
}

function frenzyAttack(character, combatState, referenceData) {
  if (!hasSubclass(character, /berserker/i) && !hasFeature(character, "Frenzy", referenceData)) return null;
  const strength = abilityModifier(character, "str");
  const attackBonus = strength + Number(character?.combat?.proficiencyBonus ?? 2);
  return option("feature_frenzy_attack", "Frenzy: Bonus Attack", "While raging in a frenzy, make one melee weapon attack as a bonus action.", {
    group: "bonus",
    cost: { bonus: true },
    tags: ["barbarian", "feature", "attack", "weapon"],
    rolls: [{ id: "attack", label: "Roll Attack", formula: `1d20${signed(attackBonus)}`, type: "attack" }],
    unavailableReasons: hasActiveEffect(combatState, "Rage") ? [] : ["Requires active Rage."],
    meta: ["Use on turns after entering frenzy"]
  });
}

function deflectMissiles(character, referenceData) {
  if (!hasFeature(character, "Deflect Missiles", referenceData) && classLevel(character, "Monk") < 3) return null;
  const dex = abilityModifier(character, "dex");
  const level = classLevel(character, "Monk");
  const focus = focusResource(character);
  return option("feature_deflect_missiles", "Deflect Missiles", "Use your reaction to reduce ranged weapon attack damage.", {
    group: "reaction",
    cost: { reaction: true },
    tags: ["monk", "feature"],
    rolls: [{ id: "reduction", label: "Roll Reduction", formula: `1d10${signed(dex + level)}`, type: "healing" }],
    meta: [
      "If damage is reduced to 0, catch the missile",
      focus ? `Spend 1 ${focus.name} to throw it back` : "Throw-back spend requires Ki/Focus tracking"
    ]
  });
}

function slowFall(character, referenceData) {
  if (!hasFeature(character, "Slow Fall", referenceData) && classLevel(character, "Monk") < 4) return null;
  const reduction = classLevel(character, "Monk") * 5;
  return option("feature_slow_fall", "Slow Fall", "Use your reaction when you fall to reduce falling damage.", {
    group: "reaction",
    cost: { reaction: true },
    tags: ["monk", "feature"],
    meta: [`Reduce falling damage by ${reduction}`]
  });
}

function stunningStrike(character, referenceData) {
  if (!hasFeature(character, "Stunning Strike", referenceData) && classLevel(character, "Monk") < 5) return null;
  const focus = focusResource(character);
  const dc = 8 + Number(character?.combat?.proficiencyBonus ?? 2) + abilityModifier(character, "wis");
  return option("feature_stunning_strike", "Stunning Strike", "After a melee weapon hit, spend 1 Ki to try to stun the target.", {
    group: "free",
    cost: { resource: classResourceCost(focus) },
    resource: focus ? focus.name : null,
    tags: ["monk", "feature", "attack"],
    unavailableReasons: focus ? [] : ["No Ki or Focus resource found to spend."],
    meta: [`CON save DC ${dc}`, "Use after a melee weapon hit"]
  });
}

function sneakAttack(character, combatState, referenceData) {
  if (!hasFeature(character, "Sneak Attack", referenceData) && classLevel(character, "Rogue") < 1) return null;
  const dice = sneakAttackDice(classLevel(character, "Rogue"));
  return option("feature_sneak_attack", "Sneak Attack", "Once per turn, add damage to an eligible finesse or ranged weapon hit.", {
    group: "free",
    tags: ["rogue", "feature", "damage", "attack"],
    rolls: [{ id: "sneakDamage", label: "Roll Sneak Attack", formula: `${dice}d6`, type: "damage" }],
    unavailableReasons: combatState?.turn?.sneakAttackUsed ? ["Sneak Attack already used this turn."] : [],
    effect: { turnFlag: "sneakAttackUsed" },
    meta: ["Requires advantage or an ally adjacent to the target", "Finesse or ranged weapon"]
  });
}

function uncannyDodge(character, referenceData) {
  if (!hasFeature(character, "Uncanny Dodge", referenceData) && classLevel(character, "Rogue") < 5) return null;
  return option("feature_uncanny_dodge_dedicated", "Uncanny Dodge", "Use your reaction to halve damage from an attack that hits you.", {
    group: "reaction",
    cost: { reaction: true },
    tags: ["rogue", "feature"],
    meta: ["Trigger: attacker you can see hits you"]
  });
}

function warCasterOpportunitySpell(character, referenceData) {
  if (!hasFeature(character, "War Caster", referenceData)) return null;
  return option("feature_war_caster_opportunity_spell", "War Caster: Opportunity Spell", "Use your reaction to cast a single-target spell instead of an opportunity attack.", {
    group: "reaction",
    cost: { reaction: true },
    tags: ["feat", "spell"],
    meta: ["Spell must target only the triggering creature", "Advantage on concentration saves"]
  });
}

function greatWeaponMasterHeavyAttack(character, referenceData) {
  if (!hasFeature(character, "Great Weapon Master", referenceData)) return null;
  if (!hasHeavyWeapon(character)) return null;
  const strength = abilityModifier(character, "str");
  const attackBonus = strength + Number(character?.combat?.proficiencyBonus ?? 2) - 5;
  return option("feature_gwm_heavy_attack", "Great Weapon Master: Heavy Attack", "Take -5 to hit with a heavy weapon to add +10 damage on hit.", {
    group: "action",
    cost: { action: true },
    tags: ["feat", "attack", "weapon"],
    attack: { consumesAttackAction: true },
    rolls: [{ id: "attack", label: "Roll Attack", formula: `1d20${signed(attackBonus)}`, type: "attack" }],
    meta: ["Apply +10 damage on hit", "Requires a heavy weapon you are proficient with"]
  });
}

function polearmMasterOpportunityTrigger(character, referenceData) {
  if (!hasFeature(character, "Polearm Master", referenceData) || !hasPolearm(character)) return null;
  return option("feature_polearm_master_opportunity", "Polearm Master: Enter Reach", "Use your reaction for an opportunity attack when a creature enters your reach.", {
    group: "reaction",
    cost: { reaction: true },
    tags: ["feat", "attack", "weapon"],
    meta: ["Requires glaive, halberd, quarterstaff, or spear"]
  });
}

function shieldMasterDexSave(character, referenceData) {
  if (!hasFeature(character, "Shield Master", referenceData)) return null;
  return option("feature_shield_master_dex_save", "Shield Master: Dexterity Save", "Apply your shield bonus to eligible Dexterity saves and avoid damage on a success.", {
    group: "free",
    tags: ["feat", "save"],
    unavailableReasons: hasShield(character) ? [] : ["Requires a shield."],
    meta: ["Use against effects that target only you", "No damage on successful eligible Dex save"]
  });
}

function option(id, name, description, extra = {}) {
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

function hasActiveEffect(combatState, name) {
  return (combatState?.current?.activeEffects ?? []).includes(name);
}

function focusResource(character) {
  return findClassResource(character, /\b(ki|focus|discipline)\b/i);
}

function classResourceCost(resource) {
  return resource ? { type: "classResource", id: resource.id, amount: 1, name: resource.name } : null;
}

function sneakAttackDice(level) {
  return Math.max(1, Math.ceil(Number(level || 1) / 2));
}

function hasPolearm(character) {
  return (character?.inventory?.weapons ?? []).some((weapon) => /glaive|halberd|quarterstaff|spear/i.test(weapon.name));
}

function hasHeavyWeapon(character) {
  return (character?.inventory?.weapons ?? []).some((weapon) => /heavy/i.test(`${weapon.properties} ${weapon.propertiesText} ${weapon.name}`));
}

function hasShield(character) {
  return (character?.inventory?.armor ?? []).some((item) => item.equipped !== false && /shield/i.test(`${item.name} ${item.type} ${item.category}`));
}

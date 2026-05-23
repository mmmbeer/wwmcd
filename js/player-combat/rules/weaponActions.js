import { normalizeName } from "../data/combatDataTransformer.js";
import { getAttackCount } from "./attackCountRules.js";
import { collectCharacterFeatures, featureText } from "./featureData.js";
import { applyWeaponFeatureRiders } from "./weaponFeatureRiders.js";

export function getWeaponActions(character, combatState, referenceData) {
  const weapons = character?.inventory?.weapons ?? [];
  const attackCount = getAttackCount(character, referenceData);

  const referenceWeapons = buildWeaponReference(referenceData?.data?.equipment);
  return [
    ...weapons.flatMap((weapon, index) => createWeaponOptions(character, combatState, referenceData, weapon, referenceWeapons, index, attackCount)),
    createUnarmedOption(character, combatState, referenceData, attackCount),
    createGrappleOption(character, attackCount),
    createShoveOption(character, attackCount)
  ];
}

function createWeaponOptions(character, combatState, referenceData, weapon, referenceWeapons, index, attackCount) {
  const reference = referenceWeapons.get(normalizeName(weapon.baseName ?? weapon.name)) ?? referenceWeapons.get(normalizeName(weapon.name)) ?? {};
  const properties = weaponPropertiesText(weapon, reference);
  const damageText = readDamage(weapon) ?? reference.damage ?? "";
  const damage = parseDamage(damageText);
  const category = weapon.category ?? weapon.type ?? reference.category;
  const variants = weaponVariants({ character, weapon, properties, damage, category, reference });
  return variants.map((variant) => createWeaponOption({
    character,
    combatState,
    referenceData,
    weapon,
    index,
    attackCount,
    properties,
    category,
    variant
  }));
}

function createWeaponOption({ character, combatState, referenceData, weapon, index, attackCount, properties, category, variant }) {
  const ability = chooseAbility(character, properties, category, variant.rangeType);
  const abilityMod = abilityModifier(character, ability);
  const attackBonus = abilityMod + Number(character?.combat?.proficiencyBonus ?? 2);
  const damageFormula = variant.damage.formula ? `${variant.damage.formula}${signed(abilityMod)}` : null;
  const rangeType = variant.rangeType;
  const range = variant.range;
  const weaponProfile = {
    ability,
    attackBonus,
    melee: rangeType === "melee",
    ranged: rangeType === "ranged",
    finesse: /finesse/i.test(properties),
    heavy: /heavy/i.test(properties),
    unarmed: false
  };

  const option = {
    id: weaponOptionId(weapon, index, variant),
    name: variant.name,
    description: [category, properties].filter(Boolean).join(" - ") || "Weapon attack.",
    source: "weapon",
    group: "action",
    tags: ["attack", "weapon", rangeType, variant.tag].filter(Boolean),
    cost: { action: true },
    attack: { count: attackCount, consumesAttackAction: true },
    range: { type: rangeType, label: range.label, normal: range.normal, long: range.long },
    recommended: index === 0,
    rolls: [
      { id: "attack", label: "Roll Attack", formula: `1d20${signed(attackBonus)}`, type: "attack" },
      damageFormula ? {
        id: "damage",
        label: "Roll Damage",
        formula: damageFormula,
        type: "damage",
        damageType: variant.damage.type
      } : null
    ].filter(Boolean),
    meta: [
      `${signed(attackBonus)} to hit`,
      `${ability.toUpperCase()} attack`,
      `${rangeType === "ranged" ? "Ranged" : "Melee"} ${range.label}`,
      attackCount > 1 ? `${attackCount} attacks with the Attack action` : "1 attack with the Attack action",
      damageFormula ? `${damageFormula} ${variant.damage.type}` : "Damage not found"
    ]
  };
  return applyWeaponFeatureRiders(option, { character, combatState, referenceData, weaponProfile });
}

function createUnarmedOption(character, combatState, referenceData, attackCount = 1) {
  const strength = abilityModifier(character, "str");
  const attackBonus = strength + Number(character?.combat?.proficiencyBonus ?? 2);
  const option = {
    id: "attack_unarmed_strike",
    name: "Unarmed Strike",
    description: "Melee attack with a punch, kick, head-butt, or similar forceful blow.",
    source: "weapon",
    group: "attack",
    tags: ["attack", "unarmed", "melee"],
    cost: { action: true },
    attack: { count: attackCount, consumesAttackAction: true },
    range: { type: "melee", label: `${meleeReach(character, "")} ft`, normal: meleeReach(character, "") },
    rolls: [
      { id: "attack", label: "Roll Attack", formula: `1d20${signed(attackBonus)}`, type: "attack" },
      { id: "damage", label: "Roll Damage", formula: `${Math.max(1, 1 + strength)}`, type: "damage", damageType: "bludgeoning" }
    ],
    meta: [
      `${signed(attackBonus)} to hit`,
      "STR attack",
      `Melee ${meleeReach(character, "")} ft`,
      attackCount > 1 ? `${attackCount} attacks with the Attack action` : "1 attack with the Attack action",
      `${Math.max(1, 1 + strength)} bludgeoning`
    ]
  };
  return applyWeaponFeatureRiders(option, {
    character,
    combatState,
    referenceData,
    weaponProfile: { ability: "str", attackBonus, melee: true, ranged: false, finesse: false, heavy: false, unarmed: true }
  });
}

function createGrappleOption(character, attackCount) {
  return specialAttack(character, "attack_grapple", "Grapple", "Use one Attack action attack to try to grapple a creature.", "Athletics check", attackCount);
}

function createShoveOption(character, attackCount) {
  return specialAttack(character, "attack_shove", "Shove", "Use one Attack action attack to knock a creature prone or push it 5 ft.", "Athletics check", attackCount);
}

function specialAttack(character, id, name, description, label, attackCount = 1) {
  const reach = meleeReach(character, "");
  return {
    id,
    name,
    description,
    source: "weapon",
    group: "attack",
    tags: ["attack", "special"],
    cost: { action: true },
    attack: { count: attackCount, consumesAttackAction: true },
    range: { type: "melee", label: `${reach} ft`, normal: reach },
    rolls: [{ id: "athletics", label: `Roll ${label}`, formula: `1d20${signed(abilityModifier(character, "str"))}`, type: "check" }],
    meta: [
      attackCount > 1 ? `Replaces one of ${attackCount} attacks from the Attack action` : "Replaces one attack from the Attack action"
    ]
  };
}

function buildWeaponReference(equipmentData) {
  const map = new Map();
  visit(equipmentData, (node, key) => {
    if (!node?.table?.Name || !node.table.Damage) return;
    node.table.Name.forEach((name, index) => {
      map.set(normalizeName(name), {
        name,
        category: key,
        damage: node.table.Damage[index],
        properties: node.table.Properties?.[index],
        rangeType: /ranged/i.test(key) ? "ranged" : "melee"
      });
    });
  });
  return map;
}

function visit(node, callback, key = "") {
  if (!node || typeof node !== "object") return;
  callback(node, key);
  for (const [childKey, child] of Object.entries(node)) {
    if (child && typeof child === "object") visit(child, callback, childKey);
  }
}

function chooseAbility(character, properties, category, rangeType) {
  const strength = abilityModifier(character, "str");
  const dexterity = abilityModifier(character, "dex");
  if (/finesse/i.test(properties)) return dexterity > strength ? "dex" : "str";
  if (rangeType === "ranged" && !/thrown/i.test(properties)) return "dex";
  if (/ammunition/i.test(properties) || /ranged/i.test(category)) return "dex";
  return "str";
}

function readDamage(weapon) {
  const dice = weapon.damage?.diceString ?? weapon.damage?.dice ?? weapon.damageDice ?? weapon.damage ?? null;
  const type = typeof weapon.damageType === "object" ? weapon.damageType.name : weapon.damageType;
  return [dice, type].filter(Boolean).join(" ") || null;
}

function parseDamage(value) {
  const match = String(value ?? "").match(/(\d+d\d+)(?:\s*\+\s*\d+)?\s*([a-z]+)?/i);
  return {
    formula: match?.[1] ?? null,
    type: match?.[2] ?? ""
  };
}

function weaponVariants({ character, weapon, properties, damage, category, reference }) {
  const text = weaponRulesText(weapon, properties, reference);
  const baseRangeType = rangeTypeFor(properties, category, reference.rangeType);
  const thrownRange = parseWeaponRange(text, "thrown");
  const rangedRange = parseWeaponRange(text, "range") ?? parseWeaponRange(text, "ammunition");
  const meleeRange = weaponRange({ character, properties, rangeType: "melee" });
  const baseRange = weaponRange({
    character,
    properties,
    rangeType: baseRangeType,
    fallback: reference.range,
    explicitRange: rangedRange ?? thrownRange
  });
  const versatileDamage = parseDamage(versatileDamageText(text));
  const baseName = weapon.name ?? "Weapon Attack";
  const meleeVariants = [];
  if (versatileDamage.formula) {
    meleeVariants.push({
      tag: "one-handed",
      name: `${baseName} (one-handed)`,
      damage,
      rangeType: "melee",
      range: meleeRange
    });
    meleeVariants.push({
      tag: "two-handed",
      name: `${baseName} (two-handed)`,
      damage: { ...versatileDamage, type: versatileDamage.type || damage.type },
      rangeType: "melee",
      range: meleeRange
    });
  } else if (baseRangeType !== "ranged" || thrownRange) {
    meleeVariants.push({ tag: "", name: baseName, damage, rangeType: "melee", range: meleeRange });
  }

  const variants = baseRangeType === "ranged" && !thrownRange
    ? [{ tag: "ranged", name: baseName, damage, rangeType: "ranged", range: baseRange }]
    : meleeVariants;

  if (thrownRange) {
    variants.push({
      tag: "thrown",
      name: `${baseName} (thrown)`,
      damage,
      rangeType: "ranged",
      range: weaponRange({ character, properties, rangeType: "ranged", explicitRange: thrownRange })
    });
  }

  return variants;
}

function rangeTypeFor(properties, category, fallback) {
  if (/ammunition|ranged/i.test(`${properties} ${category}`)) return "ranged";
  return fallback ?? "melee";
}

function weaponRange({ character, properties, rangeType, fallback, explicitRange }) {
  if (explicitRange) {
    return {
      label: `${explicitRange.normal}/${explicitRange.long} ft`,
      normal: explicitRange.normal,
      long: explicitRange.long
    };
  }
  if (rangeType === "ranged" && fallback) {
    return { label: String(fallback), normal: null, long: null };
  }
  const reach = meleeReach(character, properties);
  return { label: `${reach} ft`, normal: reach, long: null };
}

function parseWeaponRange(text, propertyName) {
  const escaped = propertyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const direct = String(text ?? "").match(new RegExp(`\\b${escaped}\\b\\s*(?:weapon)?\\s*\\(?\\s*(\\d+)\\s*\\/\\s*(\\d+)\\s*\\)?`, "i"));
  const range = String(text ?? "").match(/\brange\s*\(?\s*(\d+)\s*\/\s*(\d+)\s*\)?/i);
  const match = direct ?? (propertyName === "thrown" && !/\bthrown\b/i.test(String(text ?? "")) ? null : range);
  return match ? { normal: Number(match[1]), long: Number(match[2]) } : null;
}

function versatileDamageText(text) {
  return String(text ?? "").match(/\bversatile\b\s*\(?\s*(\d+d\d+(?:\s+[a-z]+)?)\s*\)?/i)?.[1] ?? "";
}

function weaponPropertiesText(weapon, reference) {
  return [
    weapon.properties,
    weapon.propertiesText,
    reference.properties
  ].filter(Boolean).join(", ");
}

function weaponRulesText(weapon, properties, reference) {
  return [
    properties,
    weapon.description,
    weapon.snippet,
    weapon.text,
    weapon.notes,
    weapon.range,
    formatRangeObject(weapon.range),
    reference.properties
  ].filter(Boolean).join(" ");
}

function formatRangeObject(range) {
  if (!range || typeof range !== "object") return "";
  const normal = range.normalRange ?? range.range ?? range.rangeValue ?? range.distance;
  const long = range.longRange ?? range.long;
  return normal && long ? `Range (${normal}/${long})` : "";
}

function weaponOptionId(weapon, index, variant) {
  const base = normalizeName(weapon.name).replace(/[^a-z0-9]+/g, "_") || index;
  const suffix = variant.tag ? `_${variant.tag.replace(/[^a-z0-9]+/g, "_")}` : "";
  return `weapon_${base}${suffix}`;
}

function meleeReach(character, properties) {
  return 5 + (/reach/i.test(properties) ? 5 : 0) + featureReachBonus(character);
}

function featureReachBonus(character) {
  return collectCharacterFeatures(character, null).reduce((bonus, feature) => {
    const text = `${feature.name} ${featureText(feature)}`;
    if (/long-limbed/i.test(text)) return Math.max(bonus, 5);
    const match = text.match(/(?:reach (?:increases|is increased) by|additional)\s+(\d+)\s+feet?[^.]*reach/i);
    return match ? Math.max(bonus, Number(match[1])) : bonus;
  }, 0);
}

function abilityModifier(character, ability) {
  return Math.floor((Number(character?.stats?.[ability] ?? 10) - 10) / 2);
}

function signed(value) {
  return value >= 0 ? `+${value}` : String(value);
}

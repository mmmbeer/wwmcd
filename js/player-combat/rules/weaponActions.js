import { normalizeName } from "../data/combatDataTransformer.js";
import { getAttackCount } from "./attackCountRules.js";

export function getWeaponActions(character, referenceData) {
  const weapons = character?.inventory?.weapons ?? [];
  const attackCount = getAttackCount(character, referenceData);

  const referenceWeapons = buildWeaponReference(referenceData?.data?.equipment);
  return [
    ...weapons.map((weapon, index) => createWeaponOption(character, weapon, referenceWeapons, index, attackCount)),
    createUnarmedOption(character, attackCount),
    createGrappleOption(character, attackCount),
    createShoveOption(character, attackCount)
  ];
}

function createWeaponOption(character, weapon, referenceWeapons, index, attackCount) {
  const reference = referenceWeapons.get(normalizeName(weapon.baseName ?? weapon.name)) ?? referenceWeapons.get(normalizeName(weapon.name)) ?? {};
  const properties = String(weapon.properties ?? weapon.propertiesText ?? reference.properties ?? "");
  const damageText = readDamage(weapon) ?? reference.damage ?? "";
  const damage = parseDamage(damageText);
  const category = weapon.category ?? weapon.type ?? reference.category;
  const ability = chooseAbility(character, properties, category);
  const abilityMod = abilityModifier(character, ability);
  const attackBonus = abilityMod + Number(character?.combat?.proficiencyBonus ?? 2);
  const damageFormula = damage.formula ? `${damage.formula}${signed(abilityMod)}` : null;
  const rangeType = rangeTypeFor(properties, category, reference.rangeType);

  return {
    id: `weapon_${normalizeName(weapon.name).replace(/[^a-z0-9]+/g, "_") || index}`,
    name: weapon.name ?? "Weapon Attack",
    description: [category, properties].filter(Boolean).join(" - ") || "Weapon attack.",
    source: "weapon",
    group: "action",
    tags: ["attack", "weapon", rangeType],
    cost: { action: true },
    attack: { count: attackCount, consumesAttackAction: true },
    recommended: index === 0,
    rolls: [
      { id: "attack", label: "Roll Attack", formula: `1d20${signed(attackBonus)}`, type: "attack" },
      damageFormula ? {
        id: "damage",
        label: "Roll Damage",
        formula: damageFormula,
        type: "damage",
        damageType: damage.type
      } : null
    ].filter(Boolean),
    meta: [
      `${signed(attackBonus)} to hit`,
      `${ability.toUpperCase()} attack`,
      attackCount > 1 ? `${attackCount} attacks with the Attack action` : "1 attack with the Attack action",
      damageFormula ? `${damageFormula} ${damage.type}` : "Damage not found"
    ]
  };
}

function createUnarmedOption(character, attackCount = 1) {
  const strength = abilityModifier(character, "str");
  return {
    id: "attack_unarmed_strike",
    name: "Unarmed Strike",
    description: "Melee attack with a punch, kick, head-butt, or similar forceful blow.",
    source: "weapon",
    group: "attack",
    tags: ["attack", "unarmed", "melee"],
    cost: { action: true },
    attack: { count: attackCount, consumesAttackAction: true },
    rolls: [
      { id: "attack", label: "Roll Attack", formula: `1d20${signed(strength + Number(character?.combat?.proficiencyBonus ?? 2))}`, type: "attack" },
      { id: "damage", label: "Roll Damage", formula: `${Math.max(1, 1 + strength)}`, type: "damage", damageType: "bludgeoning" }
    ],
    meta: [
      `${signed(strength + Number(character?.combat?.proficiencyBonus ?? 2))} to hit`,
      "STR attack",
      attackCount > 1 ? `${attackCount} attacks with the Attack action` : "1 attack with the Attack action",
      `${Math.max(1, 1 + strength)} bludgeoning`
    ]
  };
}

function createGrappleOption(character, attackCount) {
  return specialAttack(character, "attack_grapple", "Grapple", "Use one Attack action attack to try to grapple a creature.", "Athletics check", attackCount);
}

function createShoveOption(character, attackCount) {
  return specialAttack(character, "attack_shove", "Shove", "Use one Attack action attack to knock a creature prone or push it 5 ft.", "Athletics check", attackCount);
}

function specialAttack(character, id, name, description, label, attackCount = 1) {
  return {
    id,
    name,
    description,
    source: "weapon",
    group: "attack",
    tags: ["attack", "special"],
    cost: { action: true },
    attack: { count: attackCount, consumesAttackAction: true },
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

function chooseAbility(character, properties, category) {
  const strength = abilityModifier(character, "str");
  const dexterity = abilityModifier(character, "dex");
  if (/finesse/i.test(properties)) return dexterity > strength ? "dex" : "str";
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

function rangeTypeFor(properties, category, fallback) {
  if (/ammunition|range|ranged/i.test(`${properties} ${category}`)) return "ranged";
  return fallback ?? "melee";
}

function abilityModifier(character, ability) {
  return Math.floor((Number(character?.stats?.[ability] ?? 10) - 10) / 2);
}

function signed(value) {
  return value >= 0 ? `+${value}` : String(value);
}

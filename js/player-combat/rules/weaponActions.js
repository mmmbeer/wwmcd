import { normalizeName } from "../data/combatDataTransformer.js";

export function getWeaponActions(character, referenceData) {
  const weapons = character?.inventory?.weapons ?? [];
  if (!weapons.length) return [];

  const referenceWeapons = buildWeaponReference(referenceData?.data?.equipment);
  return weapons.map((weapon, index) => createWeaponOption(character, weapon, referenceWeapons, index));
}

function createWeaponOption(character, weapon, referenceWeapons, index) {
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
      damageFormula ? `${damageFormula} ${damage.type}` : "Damage not found"
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

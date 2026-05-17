const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];
const STAT_ID_TO_ABILITY = { 1: "str", 2: "dex", 3: "con", 4: "int", 5: "wis", 6: "cha" };

export function normalizeCharacter(raw) {
  const warnings = [];
  const errors = [];
  const root = unwrapCharacter(raw);

  if (!root || typeof root !== "object" || Array.isArray(root)) {
    return { character: null, warnings, errors: ["Character JSON must be an object."] };
  }

  const name = stringAt(root, ["name", "characterName", "identity.name"], "");
  if (!name) warnings.push("Character name missing; using Imported Character.");

  const classes = extractClasses(root, warnings);
  const level = classes.reduce((sum, entry) => sum + entry.level, 0) || numberAt(root, ["level", "identity.level"], 0);
  const stats = extractStats(root, warnings);
  const combat = extractCombat(root, stats, level);
  const spells = extractSpells(root);
  const inventory = extractInventory(root);
  const features = extractFeatures(root);

  const character = {
    id: createId(name || "character"),
    source: "dndBeyond",
    sourceVersion: stringAt(root, ["version", "dateModified", "source.sourceVersion"], null),
    importedAt: new Date().toISOString(),
    name: name || "Imported Character",
    level,
    race: {
      name: stringAt(root, ["race.fullName", "race.baseRaceName", "race.name", "species.fullName", "identity.race"], "Unknown"),
      features: features.race
    },
    classes,
    stats,
    combat,
    resources: {
      spellSlots: extractSpellSlots(root),
      classResources: arrayAt(root, ["classResources", "actions.classResources"]),
      limitedUses: arrayAt(root, ["limitedUses", "features.limitedUses"])
    },
    inventory,
    spells,
    features
  };

  if (!classes.length) warnings.push("Could not determine class details.");
  if (!combat.maxHp) warnings.push("Could not determine max HP; defaulted to 0.");

  return { character, warnings, errors };
}

function unwrapCharacter(raw) {
  return first(raw, ["character", "data.character", "data", "payload.character"]) ?? raw;
}

function extractClasses(root) {
  const rawClasses = arrayAt(root, ["classes", "classLevels", "identity.classes"]);
  return rawClasses.map((entry) => ({
    name: stringAt(entry, ["definition.name", "classDefinition.name", "name"], "Unknown class"),
    subclass: extractSubclass(entry),
    level: numberAt(entry, ["level", "classLevel"], 0),
    features: arrayAt(entry, ["features", "classFeatures"])
  })).filter((entry) => entry.name || entry.level);
}

function extractSubclass(entry) {
  const subclass = first(entry, ["subclassDefinition", "subclass", "subClassDefinition"]);
  if (!subclass) return null;
  if (typeof subclass === "string") return subclass;
  return stringAt(subclass, ["name", "definition.name"], null);
}

function extractStats(root, warnings) {
  const stats = Object.fromEntries(ABILITIES.map((ability) => [ability, 10]));
  const ddbStats = arrayAt(root, ["stats", "overrideStats"]);

  if (ddbStats.length && typeof ddbStats[0] === "object" && "id" in ddbStats[0]) {
    for (const stat of ddbStats) {
      const ability = STAT_ID_TO_ABILITY[stat.id];
      if (ability) stats[ability] = numberValue(stat.override ?? stat.value, stats[ability]);
    }
    return stats;
  }

  const abilityRoot = first(root, ["stats.abilities", "abilities", "abilityScores"]) ?? {};
  for (const ability of ABILITIES) {
    stats[ability] = numberValue(first(abilityRoot, [ability, `${ability}.score`, ability.toUpperCase()]), stats[ability]);
  }

  if (Object.values(stats).every((score) => score === 10)) {
    warnings.push("Ability scores were not found; defaulted to 10.");
  }
  return stats;
}

function extractCombat(root, stats, level) {
  const dexModifier = Math.floor((stats.dex - 10) / 2);
  const maxHp = numberAt(root, ["baseHitPoints", "hitPoints.max", "combat.hitPoints.max", "combat.maxHp"], 0);
  const currentHp = numberAt(root, ["currentHp", "hitPoints.current", "combat.hitPoints.current", "combat.currentHp"], maxHp);
  const speed = extractSpeed(root);

  return {
    maxHp,
    currentHp,
    tempHp: numberAt(root, ["temporaryHitPoints", "hitPoints.temp", "combat.hitPoints.temp", "combat.tempHp"], 0),
    ac: numberAt(root, ["armorClass", "combat.armorClass", "combat.ac"], 10 + dexModifier),
    initiativeBonus: numberAt(root, ["initiative", "combat.initiative"], dexModifier),
    proficiencyBonus: numberAt(root, ["proficiencyBonus", "stats.proficiencyBonus"], proficiencyBonusForLevel(level)),
    speed,
    conditions: arrayAt(root, ["conditions", "stats.conditions", "combat.conditions"]),
    concentration: first(root, ["concentration", "combat.concentration"]) ?? null
  };
}

function extractSpeed(root) {
  const speed = first(root, ["race.weightSpeeds.normal", "speed", "combat.speed"]) ?? {};
  if (Array.isArray(speed)) {
    const walk = numberFromText(speed[0], 30);
    return { walk, climb: 0, swim: 0, fly: 0, burrow: 0 };
  }
  return {
    walk: numberValue(first(speed, ["walk", "walking", "base"]), 30),
    climb: numberValue(speed.climb, 0),
    swim: numberValue(speed.swim, 0),
    fly: numberValue(speed.fly, 0),
    burrow: numberValue(speed.burrow, 0)
  };
}

function extractSpellSlots(root) {
  const slots = first(root, ["spellSlots", "spells.slots"]) ?? {};
  if (Array.isArray(slots)) {
    return Object.fromEntries(slots.map((slot) => [slot.level ?? slot.spellLevel, slot.available ?? slot.max ?? 0]));
  }
  return slots;
}

function extractSpells(root) {
  const known = normalizeNamedList(arrayAt(root, ["spells.known", "spells.leveled", "classSpells"]));
  const prepared = known.filter((spell) => spell.prepared);
  const cantrips = known.filter((spell) => spell.level === 0 || spell.level === "cantrip");
  return { known, prepared, cantrips };
}

function extractInventory(root) {
  const items = normalizeNamedList(arrayAt(root, ["inventory", "inventory.carried", "items"]));
  return {
    weapons: items.filter((item) => /weapon/i.test(item.type ?? item.filterType ?? "")),
    armor: items.filter((item) => /armor|shield/i.test(item.type ?? item.filterType ?? "")),
    consumables: items.filter((item) => /potion|scroll|consumable/i.test(`${item.name} ${item.type ?? ""}`)),
    magicItems: items.filter((item) => item.magic || /magic/i.test(item.type ?? "")),
    other: items
  };
}

function extractFeatures(root) {
  return {
    class: normalizeNamedList(arrayAt(root, ["features.classFeatures", "classFeatures"])),
    race: normalizeNamedList(arrayAt(root, ["features.racialTraits", "racialTraits", "race.racialTraits"])),
    feats: normalizeNamedList(arrayAt(root, ["features.feats", "feats"])),
    other: normalizeNamedList(arrayAt(root, ["features.other", "actions.other"]))
  };
}

function normalizeNamedList(items) {
  return items.map((item) => {
    const source = item.definition ?? item;
    return typeof source === "string" ? { name: source } : { ...source, name: source.name ?? source.displayAs ?? "Unnamed" };
  });
}

function first(obj, paths) {
  for (const path of paths) {
    const value = path.split(".").reduce((current, key) => current?.[key], obj);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

function stringAt(obj, paths, fallback) {
  const value = first(obj, paths);
  return value === null ? fallback : String(value);
}

function numberAt(obj, paths, fallback) {
  return numberValue(first(obj, paths), fallback);
}

function numberValue(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function numberFromText(value, fallback) {
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : fallback;
}

function arrayAt(obj, paths) {
  const value = first(obj, paths);
  return Array.isArray(value) ? value : [];
}

function proficiencyBonusForLevel(level) {
  return Math.max(2, Math.ceil((Number(level || 1) - 1) / 4) + 2);
}

function createId(name) {
  const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `ddb-${String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${suffix}`;
}

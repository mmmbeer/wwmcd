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
  const spells = extractSpells(root, classes, stats, combat.proficiencyBonus);
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
      classResources: extractLimitedResources(root, ["classResources", "actions.classResources", "resources.classResources"], "class"),
      limitedUses: extractLimitedResources(root, ["limitedUses", "features.limitedUses", "resources.limitedUses"], "feature")
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
    spellCastingAbilityId: first(entry, ["definition.spellCastingAbilityId", "classDefinition.spellCastingAbilityId", "spellCastingAbilityId"]),
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
    return Object.fromEntries(slots
      .map((slot) => [slot.level ?? slot.spellLevel, slot.available ?? slot.max ?? slot.value ?? 0])
      .filter(([level]) => level !== undefined && level !== null));
  }
  const pactSlots = arrayAt(root, ["pactMagic"]);
  if (pactSlots.length) {
    return Object.fromEntries(pactSlots.map((slot) => [slot.level ?? slot.spellLevel, slot.available ?? slot.max ?? 0]));
  }
  return slots && typeof slots === "object" ? normalizeSpellSlotMap(slots) : {};
}

function extractSpells(root, classes, stats, proficiencyBonus) {
  const spellEntries = [
    ...Object.values(first(root, ["spells"]) ?? {}).flat().filter((entry) => entry && typeof entry === "object"),
    ...arrayAt(root, ["classSpells"]).flatMap((entry) => (entry?.spells ?? []).map((spell) => ({
      ...spell,
      spellCastingAbilityId: spell?.spellCastingAbilityId ?? entry?.spellCastingAbilityId ?? entry?.characterClass?.spellCastingAbilityId
    }))),
    ...arrayAt(root, ["classSpells"]).filter((entry) => entry?.definition || entry?.name)
  ];
  const known = uniqueByName(spellEntries.map(normalizeSpell).filter((spell) => spell.name));
  const prepared = known.filter((spell) => spell.prepared);
  const cantrips = known.filter((spell) => spell.level === 0);
  const spellcastingAbility = extractSpellcastingAbility(root, classes, known);
  const modifier = spellcastingAbility ? Math.floor((Number(stats[spellcastingAbility] ?? 10) - 10) / 2) : null;
  return {
    known,
    prepared,
    cantrips,
    spellcastingAbility,
    attackBonus: modifier === null ? null : modifier + Number(proficiencyBonus ?? 2),
    saveDc: modifier === null ? null : 8 + Number(proficiencyBonus ?? 2) + modifier
  };
}

function extractInventory(root) {
  const items = arrayAt(root, ["inventory", "inventory.carried", "items"]).map(normalizeInventoryItem).filter((item) => item.name);
  return {
    weapons: items.filter((item) => isWeapon(item)),
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

function extractLimitedResources(root, paths, defaultSource) {
  return uniqueByName(arrayAt(root, paths)
    .map((item, index) => normalizeLimitedResource(item, index, defaultSource))
    .filter((resource) => resource.name && resource.max > 0));
}

function normalizeLimitedResource(item, index, defaultSource) {
  const definition = item?.definition ?? item;
  if (!definition || typeof definition !== "object") return { name: "", max: 0 };
  const limitedUse = definition.limitedUse ?? item?.limitedUse ?? {};
  const name = stringAt(definition, ["name", "displayAs", "label", "resourceName"], "")
    || stringAt(limitedUse, ["name", "displayAs", "label"], "");
  const max = resourceMax(definition, limitedUse);
  const reset = stringAt(definition, ["resetType", "reset", "recovery"], "")
    || stringAt(limitedUse, ["resetType", "reset", "recovery"], "");
  const source = stringAt(definition, ["source", "type", "activation.activationType"], defaultSource);
  const cost = numberValue(first(definition, ["activation.cost", "cost", "minNumberConsumed"]), 0)
    || numberValue(first(limitedUse, ["minNumberConsumed", "cost"]), 0);

  return {
    id: stableResourceId(name || `resource-${index}`, index),
    name,
    max,
    reset,
    source,
    cost,
    note: resourceNote(definition, limitedUse)
  };
}

function resourceMax(definition, limitedUse) {
  const value = first(definition, ["max", "maximum", "maxUses", "uses", "count", "value", "available"])
    ?? first(limitedUse, ["max", "maximum", "maxUses", "uses", "count", "value", "available"]);
  return Math.max(0, numberValue(value, 0));
}

function resourceNote(definition, limitedUse) {
  const timing = activationToCastingTime(definition.activation);
  return timing || "";
}

function stableResourceId(name, index) {
  const key = String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `resource-${key || index}`;
}

function normalizeNamedList(items) {
  return items.map((item) => {
    const source = item.definition ?? item;
    return typeof source === "string" ? { name: source } : { ...source, name: source.name ?? source.displayAs ?? "Unnamed" };
  });
}

function normalizeInventoryItem(item) {
  const definition = item?.definition ?? item;
  const damage = first(definition, ["damage", "damage.diceString", "damage.dice", "damageDice"]);
  const damageType = typeof definition?.damageType === "object" ? definition.damageType.name : definition?.damageType;
  const properties = arrayAt(definition, ["properties"])
    .map((property) => property?.name ?? property)
    .filter(Boolean)
    .join(", ");
  return {
    ...definition,
    name: definition?.name ?? item?.name ?? "Unnamed",
    baseName: definition?.name ?? item?.baseName ?? item?.name ?? "",
    type: definition?.type ?? definition?.filterType ?? item?.type ?? "",
    filterType: definition?.filterType ?? item?.filterType ?? "",
    category: definition?.category ?? definition?.type ?? "",
    equipped: Boolean(item?.equipped),
    carried: item?.equipped || item?.isCarried !== false,
    quantity: numberValue(item?.quantity ?? item?.stackSize, 1),
    damage,
    damageType,
    properties: properties || definition?.propertiesText || item?.propertiesText || ""
  };
}

function normalizeSpell(spell) {
  const definition = spell?.definition ?? spell;
  const level = normalizeSpellLevel(definition?.level ?? spell?.level);
  const range = formatRange(spell?.range ?? definition?.range);
  const saveAbility = STAT_ID_TO_ABILITY[definition?.saveDcAbilityId ?? spell?.saveDcAbilityId] ?? null;
  return {
    name: definition?.name ?? spell?.name ?? "",
    level,
    prepared: Boolean(spell?.prepared || spell?.alwaysPrepared || level === 0),
    known: Boolean(spell?.countsAsKnownSpell ?? true),
    castingTime: activationToCastingTime(spell?.activation ?? definition?.activation) ?? definition?.castingTime ?? spell?.castingTime,
    range,
    duration: definition?.duration ?? spell?.duration ?? "",
    concentration: Boolean(definition?.concentration ?? spell?.concentration),
    requiresSave: Boolean(definition?.requiresSavingThrow ?? spell?.requiresSavingThrow ?? saveAbility),
    saveAbility,
    castingAbility: STAT_ID_TO_ABILITY[spell?.spellCastingAbilityId ?? definition?.spellCastingAbilityId] ?? "",
    description: definition?.description ?? definition?.snippet ?? spell?.description ?? "",
    damage: definition?.damage ?? spell?.damage ?? null
  };
}

function extractSpellcastingAbility(root, classes, spells) {
  const explicit = [
    first(root, ["spellcastingAbilityId"]),
    ...classes.map((entry) => first(entry, ["spellCastingAbilityId", "definition.spellCastingAbilityId"])),
    ...spells.map((spell) => spell.castingAbility).filter(Boolean)
  ];
  const mapped = explicit.map((value) => STAT_ID_TO_ABILITY[value] ?? value).find((value) => ABILITIES.includes(value));
  if (mapped) return mapped;
  const classNames = classes.map((entry) => String(entry.name).toLowerCase()).join(" ");
  if (/wizard|artificer/.test(classNames)) return "int";
  if (/bard|paladin|sorcerer|warlock/.test(classNames)) return "cha";
  if (/cleric|druid|ranger/.test(classNames)) return "wis";
  return null;
}

function activationToCastingTime(activation) {
  const type = activation?.activationType;
  if (type === 1) return "1 action";
  if (type === 2) return "1 bonus action";
  if (type === 3 || type === 4) return "1 reaction";
  return null;
}

function normalizeSpellLevel(level) {
  if (String(level).toLowerCase() === "cantrip") return 0;
  return numberValue(level, 0);
}

function normalizeSpellSlotMap(slots) {
  return Object.fromEntries(Object.entries(slots).map(([level, value]) => [
    level,
    typeof value === "object" ? numberValue(value.available ?? value.max ?? value.value, 0) : numberValue(value, 0)
  ]));
}

function uniqueByName(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = String(item.name ?? "").toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isWeapon(item) {
  return /weapon/i.test(`${item.type} ${item.filterType} ${item.category}`) || Boolean(item.damage);
}

function formatRange(range) {
  if (!range || typeof range === "string") return range || "";
  const distance = range.rangeValue ?? range.distance;
  const aoe = range.aoeValue ? `${range.aoeValue} ft ${range.aoeType ?? "area"}` : "";
  return [distance ? `${distance} ft` : "", aoe].filter(Boolean).join(", ");
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
  if (value === null || value === undefined || value === "") return fallback;
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

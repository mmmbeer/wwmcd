const DAMAGE_TYPES = ["acid", "cold", "fire", "force", "lightning", "necrotic", "poison", "psychic", "radiant", "thunder"];

export function summarizeSelectedCreatures(creatures = []) {
  return creatures
    .filter((creature) => creature && typeof creature === "object")
    .slice(0, 3)
    .map(summarizeCreature);
}

function summarizeCreature(creature) {
  return pruneEmpty({
    name: creature.name,
    source: creature.source,
    size: creature.size,
    type: summarizeType(creature.type),
    alignment: creature.alignment,
    ac: summarizeAc(creature.ac),
    hp: creature.hp,
    speed: creature.speed,
    cr: creature.cr,
    proficiencyBonus: creature.pbNote ?? creature.pb,
    stats: {
      str: creature.str,
      dex: creature.dex,
      con: creature.con,
      int: creature.int,
      wis: creature.wis,
      cha: creature.cha
    },
    saves: creature.save,
    skills: creature.skill,
    passive: creature.passive,
    senses: creature.senses,
    vulnerabilities: normalizeDamageList(creature.vulnerable),
    resistances: normalizeDamageList(creature.resist),
    immunities: normalizeDamageList(creature.immune),
    conditionImmunities: creature.conditionImmune,
    traits: summarizeNamedEntries(creature.trait, 8),
    actions: summarizeNamedEntries(creature.action, 10),
    bonusActions: summarizeNamedEntries(creature.bonus, 5),
    reactions: summarizeNamedEntries(creature.reaction, 5),
    legendaryActions: summarizeNamedEntries(creature.legendary, 6)
  });
}

function summarizeType(type) {
  if (!type || typeof type !== "object") return type;
  return pruneEmpty({
    type: type.type,
    tags: type.tags
  });
}

function summarizeAc(ac) {
  if (!Array.isArray(ac)) return ac;
  return ac.map((entry) => {
    if (!entry || typeof entry !== "object") return entry;
    return pruneEmpty({
      ac: entry.ac,
      from: entry.from,
      condition: entry.condition
    });
  });
}

function summarizeNamedEntries(entries = [], limit) {
  if (!Array.isArray(entries)) return [];
  return entries.slice(0, limit).map((entry) => pruneEmpty({
    name: entry.name,
    summary: entryText(entry).slice(0, 500)
  }));
}

function entryText(entry) {
  return flattenEntries(entry?.entries ?? entry?.entry ?? []).replace(/\s+/g, " ").trim();
}

function flattenEntries(entries) {
  if (Array.isArray(entries)) return entries.map(flattenEntries).filter(Boolean).join(" ");
  if (!entries || typeof entries !== "object") return String(entries ?? "");
  return [
    entries.name,
    flattenEntries(entries.entries),
    flattenEntries(entries.items)
  ].filter(Boolean).join(" ");
}

function normalizeDamageList(value) {
  const text = flattenEntries(value).toLowerCase();
  return DAMAGE_TYPES.filter((type) => new RegExp(`\\b${type}\\b`, "i").test(text));
}

function pruneEmpty(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => {
    if (entry == null || entry === "") return false;
    if (Array.isArray(entry)) return entry.length > 0;
    if (typeof entry === "object") return Object.keys(entry).length > 0;
    return true;
  }));
}

const DATA_SETS = {
  classes: "classIndexByName",
  conditions: "conditionIndexByName",
  equipment: "equipmentIndexByName",
  feats: "featIndexByName",
  items: "itemIndexByName",
  "magic-items": "magicItemIndexByName",
  races: "raceIndexByName",
  spells: "spellIndexByName"
};

export function transformCombatData(dataByName) {
  const indexes = {};
  const counts = {};

  for (const [name, indexName] of Object.entries(DATA_SETS)) {
    const entries = name === "conditions" ? toConditionEntries(dataByName[name]) : toNamedEntries(dataByName[name]);
    indexes[indexName] = createNameIndex(entries);
    counts[name] = entries.length;
  }

  return { indexes, counts };
}

function toConditionEntries(data) {
  const appendix = data?.["Appendix PH-A: Conditions"];
  if (!appendix || typeof appendix !== "object") {
    return toNamedEntries(data);
  }

  return Object.entries(appendix)
    .filter(([name]) => name !== "content")
    .map(([name, value]) => ({ name, content: value }));
}

export function toNamedEntries(data) {
  if (Array.isArray(data)) {
    return data.map((entry) => ({
      ...entry,
      name: entry.name ?? entry.Name ?? entry.title ?? ""
    })).filter((entry) => entry.name);
  }

  if (!data || typeof data !== "object") {
    return [];
  }

  return Object.entries(data)
    .filter(([, value]) => value && typeof value === "object")
    .map(([name, value]) => ({ name, ...value }));
}

export function createNameIndex(entries) {
  return new Map(entries.map((entry) => [normalizeName(entry.name), entry]));
}

export function normalizeName(name) {
  return String(name ?? "").trim().toLowerCase();
}

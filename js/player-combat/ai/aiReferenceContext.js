import { normalizeName } from "../data/combatDataTransformer.js";

const REFERENCE_FILES = [
  "bestiary-mm",
  "classes",
  "conditions",
  "equipment",
  "feats",
  "items",
  "magic-items",
  "races",
  "spells"
];

const INDEX_BY_FILE = {
  classes: "classIndexByName",
  conditions: "conditionIndexByName",
  equipment: "equipmentIndexByName",
  feats: "featIndexByName",
  items: "itemIndexByName",
  "magic-items": "magicItemIndexByName",
  races: "raceIndexByName",
  spells: "spellIndexByName"
};

export function buildReferenceSummaries({ referenceData, character, selectedCreatures = [], availableOptions = {} } = {}) {
  const names = collectRelevantNames({ character, selectedCreatures, availableOptions });
  const data = referenceData?.data ?? {};
  const indexes = referenceData?.indexes ?? {};
  return pruneEmpty(Object.fromEntries(REFERENCE_FILES.map((file) => [
    file,
    summarizeReferenceFile(data[file], names, file, indexes)
  ])));
}

function collectRelevantNames({ character, selectedCreatures, availableOptions }) {
  const names = new Set();
  Object.values(availableOptions ?? {}).flat().forEach((option) => {
    add(names, option?.name);
    add(names, option?.spell?.reference?.name);
    add(names, option?.feature?.name);
    add(names, option?.attack?.weaponName);
  });
  (character?.classes ?? []).forEach((entry) => {
    add(names, entry?.name);
    add(names, entry?.subclass);
  });
  add(names, character?.race?.name);
  [...Object.values(character?.features ?? {}).flat(), ...(character?.race?.features ?? [])].forEach((feature) => add(names, feature?.name ?? feature));
  selectedCreatures.forEach((creature) => add(names, creature?.name));
  return names;
}

function summarizeReferenceFile(fileData, names, file, indexes = {}) {
  const entries = referenceEntries(fileData, file, indexes)
    .filter((entry) => names.has(normalizeName(entry?.name)))
    .slice(0, 20)
    .map((entry) => pruneEmpty({
      name: entry.name,
      source: entry.source,
      level: entry.level,
      type: entry.type,
      school: entry.school,
      entries: summarizeEntries(entry.entries),
      traits: summarizeEntries(entry.trait),
      actions: summarizeEntries(entry.action),
      resist: entry.resist,
      immune: entry.immune,
      vulnerable: entry.vulnerable,
      conditionImmune: entry.conditionImmune
    }));
  return entries.length ? entries : undefined;
}

function referenceEntries(fileData, file, indexes = {}) {
  if (Array.isArray(fileData)) return fileData;
  const index = indexes[INDEX_BY_FILE[file]];
  if (index instanceof Map) return [...index.values()];
  if (!fileData || typeof fileData !== "object") return [];
  const key = {
    "bestiary-mm": "monster",
    classes: "class",
    races: "race",
    spells: "spell",
    feats: "feat",
    conditions: "condition",
    equipment: "item",
    items: "item",
    "magic-items": "magicitem"
  }[file];
  const keyed = key ? fileData[key] : null;
  if (Array.isArray(keyed)) return keyed;
  return Object.values(fileData).filter((entry) => entry && typeof entry === "object");
}

function summarizeEntries(entries) {
  if (!Array.isArray(entries)) return undefined;
  return entries.slice(0, 4).map((entry) => {
    if (typeof entry === "string") return trimText(entry, 220);
    return trimText(`${entry?.name ? `${entry.name}: ` : ""}${flattenEntries(entry?.entries)}`, 220);
  }).filter(Boolean);
}

function flattenEntries(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(flattenEntries).join(" ");
  if (value && typeof value === "object") return flattenEntries(value.entries);
  return "";
}

function add(set, value) {
  const normalized = normalizeName(value);
  if (normalized) set.add(normalized);
}

function trimText(value, max) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
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

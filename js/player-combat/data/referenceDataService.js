import {
  listAvailableReferenceFiles,
  loadReferenceData as loadDmReferenceData
} from "../../../dm-roster/data/referenceDataLoader.js";
import { normalizeName, transformCombatData } from "./combatDataTransformer.js";

let cache = null;

export async function loadReferenceData() {
  const files = listAvailableReferenceFiles();
  const data = {};
  const statuses = [];

  for (const file of files) {
    try {
      data[file.name] = await loadDmReferenceData(file.name);
      statuses.push({ name: file.name, ok: true, count: countEntries(data[file.name]) });
    } catch (error) {
      data[file.name] = null;
      statuses.push({ name: file.name, ok: false, count: 0, error: error.message });
    }
  }

  const transformed = transformCombatData(data);
  for (const status of statuses) {
    status.count = transformed.counts[status.name] ?? status.count;
  }
  cache = { data, statuses, ...transformed };
  return cache;
}

export function getReferenceData() {
  return cache;
}

export function getSpellIndex() {
  return cache?.indexes.spellIndexByName ?? new Map();
}

export function getClassIndex() {
  return cache?.indexes.classIndexByName ?? new Map();
}

export function getRaceIndex() {
  return cache?.indexes.raceIndexByName ?? new Map();
}

export function getConditionIndex() {
  return cache?.indexes.conditionIndexByName ?? new Map();
}

export function getEquipmentIndex() {
  return cache?.indexes.equipmentIndexByName ?? new Map();
}

export function findByName(index, name) {
  return index.get(normalizeName(name)) ?? null;
}

function countEntries(data) {
  if (Array.isArray(data)) return data.length;
  if (data && typeof data === "object") return Object.keys(data).length;
  return 0;
}

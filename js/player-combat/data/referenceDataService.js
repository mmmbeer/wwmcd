import {
  listAvailableReferenceFiles,
  loadReferenceDataFile
} from "./referenceDataLoader.js";
import { loadRecommendationMetadata } from "./recommendationMetadataLoader.js";
import { normalizeName, transformCombatData } from "./combatDataTransformer.js";

let cache = null;

export async function loadReferenceData() {
  const files = listAvailableReferenceFiles();
  const data = {};
  const results = await Promise.all(files.map(async (file) => {
    try {
      const fileData = await loadReferenceDataFile(file.name);
      return { file, data: fileData, status: { name: file.name, ok: true, count: countEntries(fileData) } };
    } catch (error) {
      return { file, data: null, status: { name: file.name, ok: false, count: 0, error: error.message } };
    }
  }));

  const statuses = [];
  for (const result of results) {
    data[result.file.name] = result.data;
    statuses.push(result.status);
  }

  const transformed = transformCombatData(data);
  const recommendations = await loadRecommendationMetadata();
  for (const status of statuses) {
    status.count = transformed.counts[status.name] ?? status.count;
  }
  cache = {
    data: retainedReferenceData(data),
    statuses: [...statuses, ...recommendations.statuses],
    recommendations: recommendations.metadata,
    ...transformed
  };
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

function retainedReferenceData(data) {
  return {
    classes: data.classes,
    conditions: data.conditions,
    equipment: data.equipment,
    feats: data.feats,
    races: data.races,
    "bestiary-mm": data["bestiary-mm"] ? { monster: data["bestiary-mm"].monster ?? [] } : null
  };
}

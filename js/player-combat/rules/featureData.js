import { findByName } from "../data/referenceDataService.js";
import { normalizeName } from "../data/combatDataTransformer.js";

const NULL_REFERENCE_DATA = {};
const featureCache = new WeakMap();

export function collectCharacterFeatures(character, referenceData) {
  if (!character) return [];
  const referenceKey = referenceData ?? NULL_REFERENCE_DATA;
  const cached = featureCache.get(character)?.get(referenceKey);
  if (cached) return cached;

  const features = uniqueFeatures([
    ...featuresFromList(character?.features?.class, "class", referenceData),
    ...featuresFromList(character?.features?.race, "race", referenceData),
    ...featuresFromList(character?.race?.features, "race", referenceData),
    ...featuresFromList(character?.features?.feats, "feat", referenceData),
    ...featuresFromList(character?.features?.other, "feature", referenceData),
    ...featuresFromList((character?.classes ?? []).flatMap((entry) => entry.features ?? []), "class", referenceData)
  ]);
  let byReference = featureCache.get(character);
  if (!byReference) {
    byReference = new WeakMap();
    featureCache.set(character, byReference);
  }
  byReference.set(referenceKey, features);
  return features;
}

export function featureText(entry) {
  return flattenText(entry?.description ?? entry?.snippet ?? entry?.content ?? entry?.text ?? entry?.definition?.description ?? "");
}

export function flattenText(value) {
  if (Array.isArray(value)) return value.map(flattenText).join(" ");
  if (value && typeof value === "object") return Object.values(value).map(flattenText).join(" ");
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function featuresFromList(items = [], type, referenceData) {
  return items.map((item) => enrichFeature(normalizeFeature(item, type), referenceData));
}

function enrichFeature(entry, referenceData) {
  if (featureText(entry)) return entry;

  const reference = directReference(entry, referenceData) ?? searchReferenceFeature(entry, referenceData);
  if (!reference) return entry;

  return {
    ...entry,
    description: featureText(reference) || flattenText(reference),
    referenceName: reference.name ?? entry.name
  };
}

function directReference(entry, referenceData) {
  const index = entry.type === "feat" ? referenceData?.indexes?.featIndexByName : null;
  return index ? findByName(index, entry.name) : null;
}

function searchReferenceFeature(entry, referenceData) {
  const dataSets = referenceDataSearchOrder(entry.type)
    .map((name) => referenceData?.data?.[name])
    .filter(Boolean);

  for (const dataSet of dataSets) {
    const match = findFeatureInValue(dataSet, entry.name, 0);
    if (match) return match;
  }
  return null;
}

function referenceDataSearchOrder(type) {
  if (type === "class") return ["classes"];
  if (type === "race") return ["races"];
  if (type === "feat") return ["feats"];
  return ["classes", "races", "feats"];
}

function findFeatureInValue(value, name, depth) {
  if (!value || depth > 8) return null;
  const target = normalizeName(name);

  if (Array.isArray(value)) {
    for (const item of value) {
      const match = findFeatureInValue(item, name, depth + 1);
      if (match) return match;
    }
    return null;
  }

  if (typeof value !== "object") return null;
  if (normalizeName(value.name) === target || normalizeName(value.title) === target) return value;

  for (const [key, child] of Object.entries(value)) {
    if (normalizeName(key) === target) {
      return typeof child === "object" ? { name: key, ...child } : { name: key, description: child };
    }
  }

  for (const child of Object.values(value)) {
    const match = findFeatureInValue(child, name, depth + 1);
    if (match) return match;
  }
  return null;
}

function normalizeFeature(item, type) {
  const source = item?.definition ?? item;
  if (typeof source === "string") return { name: source, type };
  return {
    ...source,
    name: source?.name ?? source?.displayAs ?? "Unnamed Feature",
    type
  };
}

function uniqueFeatures(features) {
  const seen = new Set();
  return features.filter((entry) => {
    const key = `${entry.type}:${normalizeName(entry.name)}`;
    if (!entry.name || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

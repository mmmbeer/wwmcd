import { normalizeName } from "../data/combatDataTransformer.js";
import { findParsedFeatureActions, parseFeatureActionText } from "../data/featureActionParser.js";
import { collectCharacterFeatures, featureText } from "./featureData.js";

const DEDICATED_FEATURE_RULES = new Set([
  "action surge",
  "wild shape",
  "divine smite",
  "patient defense",
  "step of the wind",
  "great weapon master",
  "polearm master",
  "shield master",
  "telekinetic",
  "rage",
  "reckless attack",
  "frenzy",
  "deflect missiles",
  "slow fall",
  "stunning strike",
  "sneak attack",
  "uncanny dodge",
  "war caster"
]);

export function getFeatureActions(character, combatState, referenceData) {
  const features = collectCharacterFeatures(character, referenceData);
  const options = features
    .filter((entry) => !DEDICATED_FEATURE_RULES.has(normalizeName(entry.name)))
    .flatMap((entry) => optionsForFeature(entry, referenceData));
  return uniqueOptions(options);
}

function optionsForFeature(entry, referenceData) {
  const text = featureText(entry);
  const parsedMatches = findParsedFeatureActions(referenceData?.indexes?.featureActionIndexByName, entry);
  const parsedActions = parsedMatches.length
    ? parsedMatches.map((match) => ({ ...match.action, description: match.description, sourcePath: match.path }))
    : [parseFeatureActionText(text, entry.name)];

  return parsedActions.flatMap((action) => optionsForParsedAction(entry, action, text));
}

function optionsForParsedAction(entry, action, fallbackText) {
  const costs = action.costs.map(costObject);
  if (!costs.length) return [];

  if (action.grantedActions.length) {
    return costs.flatMap(({ label, cost }) => action.grantedActions.map((granted) => withFeatureSource(feature(
      `feature_${slug(entry.name)}_${label}_${slug(granted.name)}`,
      `${entry.name}: ${granted.name}`,
      `${costLabel(cost)} ${granted.name} enabled by ${entry.name}.`,
      cost,
      [entry.type, "feature", ...(granted.tags ?? [])].filter(Boolean),
      { featureAction: actionMeta(action) }
    ), entry)));
  }

  return costs.map(({ label, cost }) => withFeatureSource(feature(
    `feature_${slug(entry.name)}_${label}`,
    entry.name,
    action.summary || summarize(fallbackText, entry.name),
    cost,
    [entry.type, "feature"].filter(Boolean),
    { featureAction: actionMeta(action) }
  ), entry));
}

function withFeatureSource(option, entry) {
  return {
    ...option,
    id: `${option.id}_${slug(entry.type)}_${slug(entry.name)}`,
    source: "feature",
    feature: { name: entry.name, type: entry.type },
    longDescription: featureText(entry),
    meta: [titleCase(entry.type), ...(option.meta ?? [])].filter(Boolean)
  };
}

function feature(id, name, description, cost, tags, extra = {}) {
  return {
    id,
    name,
    description,
    source: "feature",
    group: cost.bonus ? "bonus" : cost.reaction ? "reaction" : cost.action ? "action" : "free",
    tags,
    cost,
    recommended: false,
    rolls: [],
    ...extra
  };
}

function costObject(label) {
  return {
    label,
    cost: {
      action: label === "action",
      bonus: label === "bonus",
      reaction: label === "reaction"
    }
  };
}

function actionMeta(action) {
  return {
    costs: action.costs,
    grantedActions: action.grantedActions.map((entry) => entry.name),
    sourcePath: action.sourcePath
  };
}

function summarize(text, fallback) {
  if (!text) return fallback;
  return text.length > 180 ? `${text.slice(0, 177).trim()}...` : text;
}

function uniqueOptions(options) {
  const seen = new Set();
  return options.filter((option) => {
    const key = `${option.id}:${option.name}:${Object.keys(option.cost ?? {}).join(",")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function costLabel(cost) {
  if (cost.bonus) return "Bonus action";
  if (cost.reaction) return "Reaction";
  if (cost.action) return "Action";
  return "Option";
}

function slug(value) {
  return normalizeName(value).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "feature";
}

function titleCase(value) {
  return String(value ?? "Feature").replace(/\b\w/g, (char) => char.toUpperCase());
}

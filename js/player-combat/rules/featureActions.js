import { normalizeName } from "../data/combatDataTransformer.js";
import { collectCharacterFeatures, featureText } from "./featureData.js";

const BASIC_ACTIONS = [
  ["Dash", /\bdash\b/i, ["movement"]],
  ["Disengage", /\bdisengage\b/i, []],
  ["Hide", /\bhide\b/i, []],
  ["Dodge", /\bdodge\b/i, []],
  ["Use an Object", /\buse an object\b/i, []],
  ["Search", /\bsearch\b/i, []],
  ["Help", /\bhelp\b/i, []]
];

export function getFeatureActions(character, combatState, referenceData) {
  const features = collectCharacterFeatures(character, referenceData);
  const options = features.flatMap((entry) => optionsForFeature(entry, combatState));
  return uniqueOptions(options);
}

function optionsForFeature(entry) {
  const text = featureText(entry);
  if (!text) return [];

  const costs = inferCosts(text);
  if (!costs.length) return [];

  const specificOptions = specificActionOptions(entry, text, costs);
  if (specificOptions.length) return specificOptions;

  return costs.map(({ cost, label }) => withFeatureSource(feature(
    `feature_${slug(entry.name)}_${label}`,
    entry.name,
    summarize(text, entry.name),
    cost,
    [entry.type, "feature"].filter(Boolean)
  ), entry));
}

function specificActionOptions(entry, text, costs) {
  const options = [];
  for (const { cost, label } of costs) {
    for (const [actionName, pattern, tags] of BASIC_ACTIONS) {
      if (!pattern.test(text)) continue;
      options.push(withFeatureSource(feature(
        `feature_${slug(entry.name)}_${label}_${slug(actionName)}`,
        `${entry.name}: ${actionName}`,
        `${costLabel(cost)} ${actionName} enabled by ${entry.name}.`,
        cost,
        [entry.type, "feature", ...tags].filter(Boolean)
      ), entry));
    }
  }
  return options;
}

function inferCosts(text) {
  return [
    [/\bbonus action\b|\bas a bonus action\b|\bwith a bonus action\b|\(\s*bonus action\s*\)/i, "bonus", { bonus: true }],
    [/\bas a reaction\b|\buse (?:a|your) reaction\b|\bwith your reaction\b|\bin reaction to\b|\(\s*reaction\s*\)/i, "reaction", { reaction: true }],
    [/\bas an action\b|\buse (?:a|your) action\b|\byou can use your action\b|\brequires you to use your action\b/i, "action", { action: true }]
  ].filter(([pattern]) => pattern.test(text)).map(([, label, cost]) => ({ label, cost }));
}

function withFeatureSource(option, entry) {
  return {
    ...option,
    id: `${option.id}_${slug(entry.type)}_${slug(entry.name)}`,
    source: "feature",
    feature: { name: entry.name, type: entry.type },
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

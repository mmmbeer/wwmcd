import { findByName } from "../data/referenceDataService.js";
import { normalizeName } from "../data/combatDataTransformer.js";

const NAMED_FEATURE_ACTIONS = {
  "cunning action": [
    feature("cunning_action_dash", "Cunning Action: Dash", "Take the Dash action as a bonus action.", { bonus: true }, ["class", "movement"]),
    feature("cunning_action_disengage", "Cunning Action: Disengage", "Take the Disengage action as a bonus action.", { bonus: true }, ["class"]),
    feature("cunning_action_hide", "Cunning Action: Hide", "Take the Hide action as a bonus action.", { bonus: true }, ["class"])
  ],
  "step of the wind": [
    feature("step_of_the_wind_dash", "Step of the Wind: Dash", "Spend 1 ki point to Dash as a bonus action; jump distance doubles this turn.", { bonus: true }, ["class", "resource", "movement"]),
    feature("step_of_the_wind_disengage", "Step of the Wind: Disengage", "Spend 1 ki point to Disengage as a bonus action; jump distance doubles this turn.", { bonus: true }, ["class", "resource"])
  ],
  "patient defense": [
    feature("patient_defense", "Patient Defense", "Spend 1 ki point to take the Dodge action as a bonus action.", { bonus: true }, ["class", "resource"])
  ],
  "flurry of blows": [
    feature("flurry_of_blows", "Flurry of Blows", "After taking the Attack action, spend 1 ki point to make two unarmed strikes as a bonus action.", { bonus: true }, ["class", "resource", "attack"])
  ],
  "rage": [
    feature("rage", "Rage", "Enter or end rage as a bonus action.", { bonus: true }, ["class", "resource"])
  ],
  "bardic inspiration": [
    feature("bardic_inspiration", "Bardic Inspiration", "Use a bonus action to inspire a creature other than yourself within 60 feet.", { bonus: true }, ["class", "resource"])
  ],
  "second wind": [
    feature("second_wind", "Second Wind", "Regain hit points equal to 1d10 + your fighter level as a bonus action.", { bonus: true }, ["class", "resource"], {
      rolls: [{ id: "healing", label: "Roll Healing", formula: "1d10", type: "healing" }]
    })
  ],
  "wild shape": [
    feature("wild_shape", "Wild Shape", "Use your action to magically assume a beast shape.", { action: true }, ["class", "resource"]),
    feature("wild_shape_revert", "Wild Shape: Revert", "Revert to your normal form as a bonus action.", { bonus: true }, ["class"])
  ],
  "breath weapon": [
    feature("breath_weapon", "Breath Weapon", "Use your action to exhale destructive energy.", { action: true }, ["race", "resource"])
  ],
  "fey step": [
    feature("fey_step", "Fey Step", "Teleport with your Fey Step feature as a bonus action.", { bonus: true }, ["race", "resource", "movement"])
  ],
  "uncanny dodge": [
    feature("uncanny_dodge", "Uncanny Dodge", "Use your reaction to halve damage from an attacker you can see.", { reaction: true }, ["class"])
  ],
  "deflect missiles": [
    feature("deflect_missiles", "Deflect Missiles", "Use your reaction to reduce ranged weapon attack damage.", { reaction: true }, ["class"])
  ],
  "slow fall": [
    feature("slow_fall", "Slow Fall", "Use your reaction while falling to reduce falling damage.", { reaction: true }, ["class"])
  ],
  "cutting words": [
    feature("cutting_words", "Cutting Words", "Use your reaction and Bardic Inspiration to subtract from a creature's roll.", { reaction: true }, ["class", "resource"])
  ],
  "protection": [
    feature("protection", "Protection", "Use your reaction to impose disadvantage on an attack against a nearby target.", { reaction: true }, ["class"])
  ],
  "defensive duelist": [
    feature("defensive_duelist", "Defensive Duelist", "Use your reaction to add proficiency bonus to AC against a melee attack.", { reaction: true }, ["feat"])
  ]
};

const INFERRED_CLASS_FEATURES = [
  { className: "rogue", level: 2, name: "Cunning Action" },
  { className: "rogue", level: 5, name: "Uncanny Dodge" },
  { className: "fighter", level: 1, name: "Second Wind" },
  { className: "barbarian", level: 1, name: "Rage" },
  { className: "druid", level: 2, name: "Wild Shape" },
  { className: "monk", level: 2, name: "Step of the Wind" },
  { className: "monk", level: 2, name: "Patient Defense" },
  { className: "monk", level: 2, name: "Flurry of Blows" },
  { className: "monk", level: 3, name: "Deflect Missiles" },
  { className: "monk", level: 4, name: "Slow Fall" },
  { className: "bard", level: 1, name: "Bardic Inspiration" }
];

export function getFeatureActions(character, combatState, referenceData) {
  const features = collectFeatures(character, referenceData);
  const options = features.flatMap((entry) => optionsForFeature(entry, combatState));
  return uniqueOptions(options);
}

function optionsForFeature(entry) {
  const key = normalizeName(entry.name);
  const named = NAMED_FEATURE_ACTIONS[key];
  if (named) return named.map((option) => withFeatureSource(option, entry));

  const text = featureText(entry);
  const costs = inferCosts(text);
  if (!costs.length) return [];

  return costs.map(({ cost, label }) => withFeatureSource(feature(
    `feature_${slug(entry.name)}_${label}`,
    entry.name,
    summarize(text, entry.name),
    cost,
    [entry.type, "feature"].filter(Boolean)
  ), entry));
}

function collectFeatures(character, referenceData) {
  return [
    ...featuresFromList(character?.features?.class, "class", referenceData),
    ...featuresFromList(character?.features?.race ?? character?.race?.features, "race", referenceData),
    ...featuresFromList(character?.features?.feats, "feat", referenceData),
    ...featuresFromList(character?.features?.other, "feature", referenceData),
    ...featuresFromList((character?.classes ?? []).flatMap((entry) => entry.features ?? []), "class", referenceData),
    ...inferredClassFeatures(character)
  ];
}

function featuresFromList(items = [], type, referenceData) {
  return items.map((item) => enrichFeature(normalizeFeature(item, type), referenceData));
}

function inferredClassFeatures(character) {
  return INFERRED_CLASS_FEATURES
    .filter((rule) => (character?.classes ?? []).some((entry) => normalizeName(entry.name) === rule.className && Number(entry.level ?? 0) >= rule.level))
    .map((rule) => ({ name: rule.name, type: "class", inferred: true }));
}

function enrichFeature(entry, referenceData) {
  if (featureText(entry)) return entry;
  const index = entry.type === "feat" ? referenceData?.indexes?.featIndexByName : null;
  const reference = index ? findByName(index, entry.name) : null;
  return reference ? { ...entry, description: reference.description ?? reference.content ?? "" } : entry;
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

function withFeatureSource(option, entry) {
  return {
    ...option,
    id: `${option.id}_${slug(entry.type)}_${slug(entry.name)}`,
    source: "feature",
    feature: { name: entry.name, type: entry.type, inferred: Boolean(entry.inferred) },
    meta: [
      titleCase(entry.type),
      entry.inferred ? "Inferred from class level" : null,
      ...(option.meta ?? [])
    ].filter(Boolean)
  };
}

function inferCosts(text) {
  if (!text) return [];
  return [
    [/\bbonus action\b|\bas a bonus action\b|\bwith a bonus action\b|\(\s*bonus action\s*\)/i, "bonus", { bonus: true }],
    [/\bas a reaction\b|\buse (?:a|your) reaction\b|\bwith your reaction\b|\bin reaction to\b|\(\s*reaction\s*\)/i, "reaction", { reaction: true }],
    [/\bas an action\b|\buse (?:a|your) action\b|\byou can use your action\b|\brequires you to use your action\b/i, "action", { action: true }]
  ].filter(([pattern]) => pattern.test(text)).map(([, label, cost]) => ({ label, cost }));
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

function featureText(entry) {
  return flattenText(entry?.description ?? entry?.snippet ?? entry?.content ?? entry?.text ?? entry?.definition?.description ?? "");
}

function flattenText(value) {
  if (Array.isArray(value)) return value.map(flattenText).join(" ");
  if (value && typeof value === "object") return Object.values(value).map(flattenText).join(" ");
  return String(value ?? "").replace(/\s+/g, " ").trim();
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

function slug(value) {
  return normalizeName(value).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "feature";
}

function titleCase(value) {
  return String(value ?? "Feature").replace(/\b\w/g, (char) => char.toUpperCase());
}

const COST_PATTERNS = [
  ["bonus", /\b(?:as|use|uses|using|spend|take|make|create|dismiss|enter|end|transform|apply|grapple|regain|expend)\b[^.]{0,90}\bbonus action\b|\(\s*bonus action\s*\)/i],
  ["reaction", /\b(?:as|use|uses|using|spend|take|make|impose|reduce|halve|add|reroll|become|manifest)\b[^.]{0,90}\breaction\b|\bin reaction to\b|\(\s*reaction\s*\)/i],
  ["action", /\bas an action\b|\buse (?:a|your) action\b|\buses your action\b|\brequires you to use your action\b|\bspend your action\b/i]
];

const GRANTED_ACTIONS = [
  ["Dash", /\bdash\b(?=[^.]{0,50}\baction\b)|\btake the dash\b/i, ["movement"]],
  ["Disengage", /\bdisengage\b(?=[^.]{0,50}\baction\b)|\btake the disengage\b/i, []],
  ["Hide", /\bhide\b(?=[^.]{0,50}\baction\b)|\btake the hide\b/i, []],
  ["Dodge", /\bdodge\b(?=[^.]{0,50}\baction\b)|\btake the dodge\b/i, []],
  ["Use an Object", /\buse an object\b(?=[^.]{0,50}\baction\b)|\btake the use an object\b/i, []],
  ["Search", /\bsearch\b(?=[^.]{0,50}\baction\b)|\btake the search\b/i, []],
  ["Help", /\bhelp\b(?=[^.]{0,50}\baction\b)|\btake the help\b/i, []],
  ["Attack", /\bmake (?:a|one|single|two)?\s*(?:melee |ranged |weapon |unarmed )?attack\b|\btake the attack action\b/i, ["attack"]]
];

export function parseFeatureActionsFromReferenceData(dataByName = {}) {
  const entries = [
    ...classFeatureEntries(dataByName.classes),
    ...featFeatureEntries(dataByName.feats),
    ...raceFeatureEntries(dataByName.races)
  ];
  const actionFeatures = entries
    .map((entry) => ({ ...entry, action: parseFeatureActionText(entry.description, entry.name) }))
    .filter((entry) => entry.action.costs.length || entry.action.grantedActions.length);

  return {
    featureActionEntries: actionFeatures,
    featureActionIndexByName: createFeatureActionIndex(actionFeatures)
  };
}

export function parseFeatureActionText(text, name = "") {
  const description = flattenText(text);
  if (!description) return emptyFeatureAction();

  const costs = COST_PATTERNS
    .filter(([, pattern]) => pattern.test(description))
    .map(([cost]) => cost);

  return {
    costs: [...new Set(costs)],
    grantedActions: grantedActions(description),
    summary: summarize(description, name)
  };
}

export function findParsedFeatureActions(index, feature) {
  const key = normalizeKey(feature?.name);
  const matches = [
    ...(index?.get(key) ?? []),
    ...colonSuffixMatches(index, key)
  ];
  if (!feature?.type) return matches;
  return matches.filter((entry) => entry.type === feature.type || compatibleType(entry.type, feature.type));
}

export function flattenText(value) {
  if (Array.isArray(value)) return value.map(flattenText).filter(Boolean).join(" ");
  if (value && typeof value === "object") return Object.values(value).map(flattenText).filter(Boolean).join(" ");
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function classFeatureEntries(data) {
  if (!data || typeof data !== "object") return [];
  return Object.entries(data).flatMap(([className, classData]) => (
    collectNamedFeatures(classData?.["Class Features"] ?? classData, {
      type: "class",
      sourceName: className,
      path: [className]
    })
  ));
}

function featFeatureEntries(data) {
  if (!Array.isArray(data)) return [];
  return data.map((feat) => ({
    type: "feat",
    name: feat.name,
    sourceName: feat.name,
    path: [feat.name],
    description: flattenText(feat.description)
  })).filter((entry) => entry.name && entry.description);
}

function raceFeatureEntries(data) {
  const races = Array.isArray(data?.races) ? data.races : Array.isArray(data) ? data : [];
  return races.flatMap((race) => [
    ...traitEntries(race.traits, race.name, [race.name]),
    ...(race.subraces ?? []).flatMap((subrace) => traitEntries(subrace.traits, race.name, [race.name, subrace.name], subrace.name))
  ]);
}

function traitEntries(traits = [], raceName, path, subraceName = null) {
  return traits.map((trait) => ({
    type: "race",
    name: trait.name,
    sourceName: raceName,
    subsourceName: subraceName,
    path: [...path, trait.name].filter(Boolean),
    description: flattenText(trait.description ?? trait.content)
  })).filter((entry) => entry.name && entry.description);
}

function collectNamedFeatures(value, context, depth = 0) {
  if (!value || depth > 8) return [];
  if (typeof value === "string") return namedEntry(context, context.name, value);
  if (Array.isArray(value)) return value.flatMap((item) => collectNamedFeatures(item, context, depth + 1));
  if (typeof value !== "object") return [];

  const entries = [];
  for (const [key, child] of Object.entries(value)) {
    if (key === "content" || key === "table") continue;
    const childContext = { ...context, name: key, path: [...context.path, key] };
    const text = directFeatureText(child);
    if (text) entries.push(...namedEntry(childContext, key, text));
    if (child && typeof child === "object") entries.push(...collectNamedFeatures(child, childContext, depth + 1));
  }
  return uniqueEntryPaths(entries);
}

function directFeatureText(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return flattenText(value);
  if (value && typeof value === "object" && "content" in value) return flattenText(value.content);
  return "";
}

function namedEntry(context, name, description) {
  const text = flattenText(description);
  if (!name || !text) return [];
  return [{
    type: context.type,
    name,
    sourceName: context.sourceName,
    path: context.path,
    description: text
  }];
}

function grantedActions(text) {
  const actionText = text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => grantedActionContext(sentence) && !targetOnlyContext(sentence))
    .join(" ");
  if (!actionText) return [];
  return GRANTED_ACTIONS
    .filter(([, pattern]) => pattern.test(actionText))
    .map(([name, , tags]) => ({ name, tags }));
}

function grantedActionContext(text) {
  return /\b(?:can be used only to|can use .* to|spend .* to|granted by|as part of|immediately after you take|when you use the attack action)\b/i.test(text);
}

function targetOnlyContext(text) {
  return /\bfor its action\b|\bcreature can use only\b|\bit can use only\b/i.test(text);
}

function createFeatureActionIndex(entries) {
  const index = new Map();
  for (const entry of entries) {
    const key = normalizeKey(entry.name);
    if (!key) continue;
    index.set(key, [...(index.get(key) ?? []), entry]);
  }
  return index;
}

function compatibleType(parsedType, featureType) {
  return parsedType === "feat" && featureType === "feature";
}

function uniqueEntryPaths(entries) {
  const seen = new Set();
  return entries.filter((entry) => {
    const key = `${entry.type}:${entry.path.join(">")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function summarize(text, fallback) {
  if (!text) return fallback;
  return text.length > 180 ? `${text.slice(0, 177).trim()}...` : text;
}

function emptyFeatureAction() {
  return { costs: [], grantedActions: [], summary: "" };
}

function colonSuffixMatches(index, key) {
  if (!index || !key) return [];
  const suffix = `: ${key}`;
  return [...index.entries()]
    .filter(([entryKey]) => entryKey.endsWith(suffix))
    .flatMap(([, entries]) => entries);
}

function normalizeKey(name) {
  return String(name ?? "").trim().toLowerCase();
}

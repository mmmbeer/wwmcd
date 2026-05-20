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
    .flatMap((entry) => optionsForFeature(entry, character, referenceData));
  return uniqueOptions(options);
}

function optionsForFeature(entry, character, referenceData) {
  const text = featureText(entry);
  const parsedMatches = findParsedFeatureActions(referenceData?.indexes?.featureActionIndexByName, entry);
  const parsedActions = parsedMatches.length
    ? parsedMatches.map((match) => ({ ...match.action, description: match.description, sourcePath: match.path }))
    : [parseFeatureActionText(text, entry.name)];

  return [
    ...parsedActions.flatMap((action) => optionsForParsedAction(entry, action, text)),
    ...featureSpellOptions(entry, text, character, referenceData)
  ];
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

function featureSpellOptions(entry, text, character, referenceData) {
  const spellIndex = referenceData?.indexes?.spellIndexByName;
  if (!text || !spellIndex || !/\bcast\b/i.test(text)) return [];

  return [...spellIndex.values()]
    .filter((spell) => spell?.name && mentionsCastSpell(text, spell.name))
    .filter((spell) => characterMeetsFeatureSpellLevel(character, text, spell.name))
    .map((spell) => featureSpellOption(entry, text, spell));
}

function featureSpellOption(entry, text, spell) {
  const cost = costFromCastingTime(spell.casting_time ?? "1 action");
  const level = normalizeSpellLevel(spell.level);
  const description = `Cast ${spell.name} using ${entry.name}.`;
  const option = withFeatureSource(feature(
    `feature_${slug(entry.name)}_cast_${slug(spell.name)}`,
    `${entry.name}: ${spell.name}`,
    description,
    cost,
    [entry.type, "feature", "spell", level === 0 ? "cantrip" : "leveled-spell"].filter(Boolean),
    {
      resource: entry.name,
      spell: {
        level,
        concentration: /concentration/i.test(`${spell.duration ?? ""} ${spell.description ?? ""}`),
        castingTime: spell.casting_time ?? "1 action",
        castingCost: castingCostName(cost),
        range: spell.range,
        saveAbility: inferSaveAbility(spell.description ?? ""),
        reference: {
          ...spell,
          level,
          casting_time: spell.casting_time ?? "1 action",
          description: spell.description ?? ""
        }
      },
      meta: [
        "Feature-granted spellcasting",
        "Does not require a spell slot unless you choose to cast it with one",
        "Usage limit may need manual tracking"
      ],
      longDescription: text
    }
  ), entry);

  return { ...option, description };
}

function mentionsCastSpell(text, spellName) {
  const escaped = escapeRegExp(spellName).replace(/\s+/g, "\\s+");
  const spellPattern = new RegExp(`\\b${escaped}\\b`, "i");
  if (!spellPattern.test(text)) return false;
  const castNearSpell = new RegExp(`\\bcast\\b[^.]{0,160}\\b${escaped}\\b|\\b${escaped}\\b[^.]{0,160}\\bcast\\b`, "i");
  return castNearSpell.test(text);
}

function characterMeetsFeatureSpellLevel(character, text, spellName) {
  const index = text.search(new RegExp(`\\b${escapeRegExp(spellName).replace(/\s+/g, "\\s+")}\\b`, "i"));
  if (index < 0) return true;
  const before = text.slice(Math.max(0, index - 180), index);
  const matches = [...before.matchAll(/\b(?:reach|reaches|at)\s+(?:character\s+)?(?:level\s+)?(\d+)(?:st|nd|rd|th)?\s+level|\b(\d+)(?:st|nd|rd|th)?\s+level\b/gi)];
  const required = Number(matches.at(-1)?.[1] ?? matches.at(-1)?.[2] ?? 0);
  return !required || Number(character?.level ?? 0) >= required;
}

function costFromCastingTime(castingTime) {
  const value = String(castingTime ?? "").toLowerCase();
  if (/\bbonus(?:\s+action)?\b/.test(value)) return { bonus: true };
  if (/\breaction\b/.test(value)) return { reaction: true };
  if (/\baction\b/.test(value)) return { action: true };
  return {};
}

function castingCostName(cost) {
  if (cost.bonus) return "bonus";
  if (cost.reaction) return "reaction";
  if (cost.action) return "action";
  return "special";
}

function normalizeSpellLevel(level) {
  if (String(level).toLowerCase() === "cantrip") return 0;
  const numeric = Number(level);
  return Number.isFinite(numeric) ? numeric : 0;
}

function inferSaveAbility(description) {
  const match = String(description ?? "").match(/\b(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+saving throw/i);
  return match ? match[1].slice(0, 3).toLowerCase() : null;
}

function escapeRegExp(value) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

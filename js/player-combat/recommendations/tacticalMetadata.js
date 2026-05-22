import { normalizeName } from "../data/combatDataTransformer.js";

const USEFULNESS_SCORE = {
  avoid: -34,
  situational: -8,
  normal: 0,
  strong: 14,
  signature: 24
};

const ROLE_SCORE = {
  damage: { damage: 14 },
  control: { control: 14 },
  support: { support: 14 },
  defense: { defense: 14 },
  mobility: { mobility: 14 },
  utility: {},
  advantageSetup: { support: 8, control: 8 },
  advantageAmplifier: { damage: 10 },
  minionClear: { damage: 12, control: 4 },
  bossDebuff: { control: 12 },
  saveOrSuck: { control: 16 },
  nova: { damage: 14, resourceFit: 4 },
  escape: { mobility: 12, defense: 8 },
  reactionProtection: { defense: 16 }
};

const TYPE_KEYS = {
  spell: ["spellTactics"],
  weapon: ["equipmentTactics", "itemTactics"],
  item: ["itemTactics", "equipmentTactics"],
  equipment: ["equipmentTactics", "itemTactics"],
  feature: ["classFeatureTactics", "featTactics", "raceFeatureTactics"],
  basic: ["classFeatureTactics"]
};

export function enrichOptionWithTactics(option, metadata) {
  const tactics = findTactics(option, metadata);
  return tactics ? { ...option, tactics } : option;
}

export function applyTacticalMetadata(scores, option, context) {
  const tactics = option.tactics;
  if (!tactics) return 0;

  for (const role of tactics.roles ?? []) {
    addScores(scores, ROLE_SCORE[role]);
  }

  applyListMatch(scores, tactics.goodSituations, context.answers.situation, 10);
  applyListMatch(scores, tactics.badSituations, context.answers.situation, -16);
  applyListMatch(scores, tactics.goodDifficulties, context.answers.difficulty, 8);
  applyListMatch(scores, tactics.badDifficulties, context.answers.difficulty, -12);

  const range = optionRangeBand(option);
  applyListMatch(scores, tactics.goodRanges, range, 8);
  applyListMatch(scores, tactics.badRanges, range, -10);

  if (hasCharacterSynergy(tactics, context.character)) {
    addScores(scores, { damage: 8, support: 6, control: 6 });
  }

  return Number(tactics.recommendationBonus ?? 0)
    - Number(tactics.recommendationPenalty ?? 0)
    + (USEFULNESS_SCORE[tactics.combatUsefulness] ?? 0);
}

export function tacticalReasons(option, context) {
  const tactics = option.tactics;
  if (!tactics) return [];

  const reasons = [...(tactics.reasonBoosts ?? [])];
  if (hasCharacterSynergy(tactics, context.character)) {
    reasons.push(`Synergy: ${matchingSynergies(tactics, context.character).join(", ")}`);
  }
  if (context.answers.situation && tactics.goodSituations?.includes(context.answers.situation)) {
    reasons.push(situationReason(context.answers.situation));
  }
  if (context.answers.difficulty && tactics.goodDifficulties?.includes(context.answers.difficulty)) {
    reasons.push(`${capitalize(context.answers.difficulty)} encounter metadata fit`);
  }

  return reasons;
}

function findTactics(option, metadata = {}) {
  const keys = TYPE_KEYS[option.source] ?? [];
  const names = optionNames(option);

  for (const key of keys) {
    const match = findByNames(metadata[key], names);
    if (match) return match;
  }

  for (const tacticsByName of Object.values(metadata)) {
    const match = findByNames(tacticsByName, names);
    if (match) return match;
  }
  return null;
}

function findByNames(tacticsByName = {}, names) {
  for (const name of names) {
    const exact = tacticsByName[name];
    if (exact) return exact;
    const normalized = normalizeName(name);
    const entry = Object.entries(tacticsByName).find(([key]) => normalizeName(key) === normalized);
    if (entry) return entry[1];
  }
  return null;
}

function optionNames(option) {
  const names = [
    option.name,
    option.spell?.reference?.name,
    option.feature?.name,
    option.attack?.weaponName
  ].filter(Boolean);
  return [...new Set(names.flatMap((name) => [name, String(name).split(":")[0].trim()]))];
}

function addScores(scores, adjustments = {}) {
  for (const [key, value] of Object.entries(adjustments)) {
    scores[key] = (scores[key] ?? 0) + value;
  }
}

function applyListMatch(scores, list, value, amount) {
  if (!value || !list?.includes(value)) return;
  const key = amount > 0 ? "resourceFit" : "damage";
  scores[key] = (scores[key] ?? 0) + amount;
}

function hasCharacterSynergy(tactics, character) {
  return matchingSynergies(tactics, character).length > 0;
}

function matchingSynergies(tactics, character) {
  const characterText = [
    ...(character?.features?.class ?? []),
    ...(character?.features?.race ?? []),
    ...(character?.race?.features ?? []),
    ...(character?.features?.feats ?? []),
    ...(character?.features?.other ?? []),
    ...(character?.classes ?? []).flatMap((entry) => entry.features ?? [])
  ].map((entry) => `${entry?.name ?? entry} ${entry?.description ?? ""}`).join(" ").toLowerCase();

  return (tactics.synergies ?? []).filter((name) => characterText.includes(normalizeName(name)));
}

function situationReason(value) {
  return {
    single: "Single-target metadata fit",
    multiple: "Multi-target metadata fit",
    bigBad: "Big Bad metadata fit",
    bigBadMinions: "Big Bad + Minions metadata fit",
    ally: "Ally support metadata fit",
    self: "Self-defense metadata fit"
  }[value] ?? "Tactical metadata fit";
}

function optionRangeBand(option) {
  const type = option.range?.type ?? "";
  if (type === "melee" || /\btouch\b/i.test(String(option.spell?.range))) return "melee";
  const range = Number(option.range?.normal ?? String(option.range?.label ?? option.spell?.range ?? "").match(/(\d+)/)?.[1] ?? 0);
  if (range > 0 && range <= 5 && type !== "ranged") return "melee";
  if (range > 0 && range < 30) return "near";
  if (range >= 30 && range <= 90) return "long";
  if (range > 90) return "far";
  if (type === "ranged") return "long";
  return "unknown";
}

function capitalize(value) {
  const text = String(value ?? "");
  return text ? `${text[0].toUpperCase()}${text.slice(1)}` : "";
}

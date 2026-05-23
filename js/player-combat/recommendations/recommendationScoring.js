import {
  applyTacticalMetadata,
  enrichOptionWithTactics,
  tacticalReasons
} from "./tacticalMetadata.js";
export { getRankedRecommendationSets } from "./recommendationSets.js";

const DEFAULT_ANSWERS = {
  goal: "damage",
  situation: "single",
  distance: "unknown",
  difficulty: "medium",
  resources: "normal",
  rollMode: "normal",
  concentration: "allow"
};

const GOAL_WEIGHTS = {
  balanced: { damage: 1, support: 1, control: 1, defense: 1, mobility: 1 },
  damage: { damage: 2.5, support: 0.7, control: 1, defense: 0.7, mobility: 0.8 },
  support: { damage: 0.6, support: 2.6, control: 1, defense: 1.2, mobility: 0.8 },
  control: { damage: 0.8, support: 0.9, control: 2.6, defense: 1, mobility: 0.8 },
  defense: { damage: 0.6, support: 1.1, control: 1, defense: 2.6, mobility: 1.1 },
  mobility: { damage: 0.7, support: 0.7, control: 0.9, defense: 1.1, mobility: 2.5 }
};

const SUPPORT_TERMS = /\b(heal|healing|restore|recover|temporary hit points|help|aid|bless|inspiration|bardic|guidance|cure|revivify|stabilize)\b/i;
const CONTROL_TERMS = /\b(stun|restrain|prone|grapple|shove|push|pull|frighten|charm|banish|hold|slow|web|entangle|restrained|incapacitated|save|saving throw|dc)\b/i;
const DEFENSE_TERMS = /\b(dodge|shield|disengage|resistance|resist|ac|armor class|deflect|uncanny|protect|sanctuary|blur|mirror image)\b/i;
const MOBILITY_TERMS = /\b(move|dash|disengage|teleport|misty step|fly|climb|swim|speed|jump)\b/i;
const AREA_TERMS = /\b(cone|cube|sphere|radius|line|each creature|creatures of your choice|area)\b/i;
const SAVE_OR_SUCK_TERMS = /\b(stun|restrain|paralyze|banish|hold|incapacitated|frighten|charm|restrained|prone)\b/i;

export function getDefaultRecommendationAnswers(context = {}) {
  const situation = context.answers?.situation ?? DEFAULT_ANSWERS.situation;
  return {
    ...DEFAULT_ANSWERS,
    resources: defaultResourceAnswer({
      character: context.character,
      combatState: context.combatState,
      situation
    }),
    concentration: context.combatState?.current?.concentration ? "avoid" : "allow"
  };
}

export function getRecommendationQuestionConfig(groups, answers = DEFAULT_ANSWERS, context = {}) {
  const defaults = getDefaultRecommendationAnswers({
    ...context,
    answers
  });
  const options = collectOptions(groups);
  const hasSpells = options.some((option) => option.source === "spell" || option.spell);
  const hasResources = options.some((option) => option.cost?.resource || option.resource);
  const hasConcentration = options.some((option) => option.spell?.concentration);
  const hasSupport = options.some((option) => SUPPORT_TERMS.test(optionText(option)));
  const hasControl = options.some((option) => CONTROL_TERMS.test(optionText(option)));
  const hasMobility = options.some((option) => option.cost?.movement || MOBILITY_TERMS.test(optionText(option)));

  return [
    {
      id: "goal",
      label: "Goal",
      options: [
        ["balanced", "Balanced"],
        ["damage", "Damage"],
        hasSupport ? ["support", "Support"] : null,
        hasControl ? ["control", "Control"] : null,
        ["defense", "Defense"],
        hasMobility ? ["mobility", "Mobility"] : null
      ].filter(Boolean)
    },
    {
      id: "situation",
      label: "Situation",
      options: [
        ["single", "Single target"],
        ["multiple", "Multiple foes"],
        ["bigBad", "Big Bad"],
        ["bigBadMinions", "Big Bad + Minions"],
        ["ally", "Ally in danger"],
        ["self", "Self in danger"]
      ]
    },
    {
      id: "distance",
      label: "Range",
      options: [
        ["unknown", "Any"],
        ["melee", "Melee"],
        ["near", "Near (< 30 ft)"],
        ["long", "Long (30-90 ft)"],
        ["far", "Far (> 90 ft)"]
      ]
    },
    {
      id: "difficulty",
      label: "DC",
      options: [
        ["easy", "Easy"],
        ["medium", "Medium"],
        ["hard", "Hard"],
        ["deadly", "Deadly"]
      ]
    },
    hasResources || hasSpells ? {
      id: "resources",
      label: "Resources",
      options: [
        ["conserve", "Conserve"],
        ["normal", "Normal"],
        ["spend", "Spend"]
      ]
    } : null,
    {
      id: "rollMode",
      label: "Rolls",
      options: [
        ["normal", "Normal"],
        ["advantage", "Advantage"],
        ["disadvantage", "Disadvantage"]
      ]
    },
    hasConcentration ? {
      id: "concentration",
      label: "Concentration",
      options: [
        ["allow", "Allow"],
        ["avoid", "Avoid changing"],
        ["prefer", "Prefer"]
      ]
    } : null
  ].filter(Boolean).map((question) => ({
    ...question,
    value: answers[question.id] ?? defaults[question.id]
  }));
}

export function getContextualRecommendationAnswers(answers = {}, context = {}) {
  const defaults = getDefaultRecommendationAnswers({ ...context, answers });
  return {
    ...defaults,
    ...answers,
    resources: !answers.resources || answers.resources === DEFAULT_ANSWERS.resources ? defaults.resources : answers.resources,
    concentration: !answers.concentration || answers.concentration === DEFAULT_ANSWERS.concentration ? defaults.concentration : answers.concentration
  };
}

export function getRankedRecommendations({ groups, character, combatState, answers = {}, referenceData, tacticalMetadata }) {
  const resolvedAnswers = { ...DEFAULT_ANSWERS, ...answers };
  const metadata = tacticalMetadata ?? referenceData?.recommendations;
  const options = collectOptions(groups).map((option) => enrichOptionWithTactics(option, metadata));
  return options
    .map((option) => scoreOption(option, { character, combatState, answers: resolvedAnswers }))
    .sort((a, b) => b.score - a.score || Number(a.option.available === false) - Number(b.option.available === false) || a.option.name.localeCompare(b.option.name))
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
      option: {
        ...entry.option,
        recommendation: {
          rank: index + 1,
          score: entry.score,
          reasons: entry.reasons,
          warnings: entry.warnings,
          categoryScores: entry.categoryScores
        }
      }
    }));
}

function scoreOption(option, context) {
  const categoryScores = {
    damage: damageScore(option, context),
    support: keywordScore(option, SUPPORT_TERMS, 20),
    control: keywordScore(option, CONTROL_TERMS, 20),
    defense: keywordScore(option, DEFENSE_TERMS, 20),
    mobility: mobilityScore(option),
    resourceFit: resourceFitScore(option, context.answers)
  };
  applySituationAdjustments(categoryScores, option, context);
  applyDistanceAdjustments(categoryScores, option, context.answers);
  applyDifficultyAdjustments(categoryScores, option, context.answers);
  applyRollModeAdjustments(categoryScores, option, context.answers);
  applyConcentrationAdjustments(categoryScores, option, context);
  const tacticalAdjustment = applyTacticalMetadata(categoryScores, option, context);

  const weights = GOAL_WEIGHTS[context.answers.goal] ?? GOAL_WEIGHTS.balanced;
  const weighted = Object.entries(weights).reduce((total, [key, weight]) => total + categoryScores[key] * weight, 0);
  const availability = option.available === false ? -140 : 25;
  const base = option.recommended ? 8 : 0;
  const score = Math.round(weighted + categoryScores.resourceFit + tacticalAdjustment + availability + base);

  return {
    option,
    score,
    categoryScores,
    reasons: recommendationReasons(option, categoryScores, context),
    warnings: recommendationWarnings(option, context)
  };
}

function collectOptions(groups) {
  const byId = new Map();
  for (const group of ["attacks", "actions", "spells", "bonus", "reaction", "free", "movement", "resources", "recommended"]) {
    for (const option of groups?.[group] ?? []) {
      if (option?.id && isRecommendationCandidate(option) && !byId.has(option.id)) byId.set(option.id, option);
    }
  }
  return [...byId.values()];
}

function isRecommendationCandidate(option) {
  if (!option?.spell) return true;
  const hasTurnCost = Boolean(option.cost?.action || option.cost?.bonus || option.cost?.reaction);
  if (!hasTurnCost) return false;
  return !option.spell?.castingCost || ["action", "bonus", "reaction"].includes(option.spell.castingCost);
}

function damageScore(option, context) {
  const damageRolls = option.rolls?.filter((roll) => roll.type === "damage" || roll.id === "damage") ?? [];
  const average = damageRolls.reduce((total, roll) => total + averageFormula(roll.formula), 0);
  let score = Math.min(60, average * 4);
  if (option.rolls?.some((roll) => roll.type === "attack" || roll.id === "attack")) score += 8;
  if (isAreaOption(option)) {
    const areaBonus = context.answers.situation === "multiple" || context.answers.situation === "bigBadMinions" ? 18 : 4;
    score += areaBonus;
  }
  if (option.spell && Number(option.spell.level ?? 0) === 0) score += 4;
  return score;
}

function mobilityScore(option) {
  if (option.cost?.movement || option.group === "movement") return 42;
  return keywordScore(option, MOBILITY_TERMS, 18);
}

function keywordScore(option, pattern, value) {
  const text = optionText(option);
  let score = pattern.test(text) ? value : 0;
  if (option.meta?.some((item) => pattern.test(String(item)))) score += Math.round(value / 2);
  return score;
}

function resourceFitScore(option, answers) {
  const hasResource = Boolean(option.cost?.resource || option.resource);
  if (!hasResource) return answers.resources === "conserve" ? 16 : 8;
  if (answers.resources === "conserve") return -72;
  if (answers.resources === "spend") return 18;
  return -4;
}

function defaultResourceAnswer({ character, combatState, situation }) {
  const resourceRatio = remainingSpendableResourceRatio(character, combatState);
  if (resourceRatio !== null && resourceRatio < 0.2) return "conserve";
  return situation && situation !== "single" ? "spend" : "normal";
}

function remainingSpendableResourceRatio(character, combatState) {
  const resources = spendableResources(character, combatState);
  if (!resources.length) return null;
  const total = resources.reduce((sum, resource) => sum + resource.max, 0);
  const remaining = resources.reduce((sum, resource) => sum + Math.max(0, resource.max - resource.used), 0);
  return total > 0 ? remaining / total : null;
}

function spendableResources(character, combatState) {
  const spellSlots = Object.entries(character?.resources?.spellSlots ?? {}).map(([level, value]) => {
    const max = spellSlotMax(value);
    const used = Number(combatState?.resourcesUsed?.spellSlots?.[level] ?? 0);
    return { max, used };
  });
  const limited = [
    ...(character?.resources?.classResources ?? []),
    ...(character?.resources?.limitedUses ?? [])
  ].map((resource) => ({
    max: Number(resource?.max ?? 0),
    used: Number(combatState?.resourcesUsed?.classResources?.[resource?.id] ?? 0)
  }));
  return [...spellSlots, ...limited].filter((resource) => resource.max > 0);
}

function spellSlotMax(value) {
  if (value && typeof value === "object") return Number(value.available ?? value.max ?? value.value ?? 0);
  return Number(value ?? 0);
}

function applySituationAdjustments(scores, option, context) {
  const text = optionText(option);
  if (context.answers.situation === "ally") scores.support += 28;
  if (context.answers.situation === "self") scores.defense += 26;
  if (context.answers.situation === "multiple" && isAreaOption(option)) {
    scores.damage += 14;
    scores.control += 12;
  }
  if (context.answers.situation === "bigBad") {
    scores.damage += isAreaOption(option) ? -4 : 12;
    scores.control += SAVE_OR_SUCK_TERMS.test(text) ? 22 : 8;
    scores.resourceFit += hasResourceCost(option) ? 10 : 0;
  }
  if (context.answers.situation === "bigBadMinions") {
    scores.damage += isAreaOption(option) ? 18 : 8;
    scores.control += isAreaOption(option) || SAVE_OR_SUCK_TERMS.test(text) ? 16 : 6;
    scores.resourceFit += hasResourceCost(option) ? 8 : 0;
  }
}

function applyDistanceAdjustments(scores, option, answers) {
  const selected = answers.distance;
  if (!selected || selected === "unknown") return;
  const band = optionRangeBand(option);
  if (selected === band) {
    scores.damage += 14;
    scores.control += 6;
    return;
  }
  if (selected === "melee") {
    scores.damage -= band === "melee" ? 0 : 18;
    scores.control -= band === "far" ? 8 : 0;
  }
  if (selected === "near") {
    if (band === "melee") scores.damage += 4;
    if (band === "far") scores.damage -= 14;
  }
  if (selected === "long") {
    if (band === "melee" || band === "near") scores.damage -= 14;
    if (band === "far") scores.damage += 4;
  }
  if (selected === "far") {
    if (band === "far") scores.damage += 16;
    if (band === "melee" || band === "near") scores.damage -= 24;
    if (band === "long") scores.damage -= 8;
  }
}

function applyDifficultyAdjustments(scores, option, answers) {
  if (answers.difficulty === "easy") {
    scores.resourceFit += hasResourceCost(option) ? -18 : 8;
    scores.defense -= 4;
    return;
  }
  if (answers.difficulty === "hard") {
    scores.control += 8;
    scores.defense += 8;
    scores.resourceFit += hasResourceCost(option) ? 8 : 0;
    if (isAttackOption(option)) scores.damage += 4;
  }
  if (answers.difficulty === "deadly") {
    scores.control += 14;
    scores.defense += 16;
    scores.resourceFit += hasResourceCost(option) ? 18 : -2;
    if (isAttackOption(option)) scores.damage += 8;
  }
}

function applyRollModeAdjustments(scores, option, answers) {
  if (!option.rolls?.some((roll) => roll.type === "attack" || roll.id === "attack")) return;
  if (answers.rollMode === "advantage") scores.damage += 10;
  if (answers.rollMode === "disadvantage") scores.damage -= 14;
}

function applyConcentrationAdjustments(scores, option, context) {
  if (!option.spell?.concentration) return;
  if (context.answers.concentration === "prefer") scores.control += 18;
  if (context.answers.concentration !== "avoid") return;
  scores.control -= 8;
  scores.resourceFit -= context.combatState?.current?.concentration ? 34 : 12;
}

function recommendationReasons(option, scores, context) {
  const reasons = [];
  reasons.push(...tacticalReasons(option, context));
  if (scores.damage >= 30) reasons.push("High damage");
  if (scores.support >= 28) reasons.push("Strong support");
  if (scores.control >= 28) reasons.push("Control option");
  if (scores.defense >= 28) reasons.push("Defensive fit");
  if (scores.mobility >= 28) reasons.push("Improves position");
  if (!option.cost?.resource && !option.resource) reasons.push("No resource cost");
  if (option.cost?.bonus) reasons.push("Uses bonus action");
  if (option.cost?.reaction) reasons.push("Reaction option");
  if (context.answers.resources === "spend" && (option.cost?.resource || option.resource)) reasons.push("Resource spend fits");
  if (context.answers.situation === "bigBad" && (scores.damage >= 30 || scores.control >= 28)) reasons.push("Big Bad pressure");
  if (context.answers.situation === "bigBadMinions" && isAreaOption(option)) reasons.push("Handles minions");
  if ((context.answers.difficulty === "hard" || context.answers.difficulty === "deadly") && (scores.defense >= 28 || scores.control >= 28)) {
    reasons.push(`${capitalize(context.answers.difficulty)} encounter fit`);
  }
  if (context.answers.distance !== "unknown" && optionRangeBand(option) === context.answers.distance) reasons.push("Range fit");
  if (option.available === false) reasons.push("Currently unavailable");
  return [...new Set(reasons)].slice(0, 6);
}

function recommendationWarnings(option, context) {
  const warnings = [...(option.warnings ?? [])];
  if (option.spell?.concentration && context.combatState?.current?.concentration) {
    warnings.push(`May replace ${context.combatState.current.concentration}`);
  }
  if (option.available === false && option.unavailableReasons?.length) warnings.push(option.unavailableReasons.join(" "));
  return [...new Set(warnings)].slice(0, 3);
}

function optionText(option) {
  return [
    option.name,
    option.description,
    option.longDescription,
    option.spell?.reference?.description,
    option.featureAction?.description,
    ...(option.meta ?? []),
    ...(option.tags ?? [])
  ].filter(Boolean).join(" ");
}

function hasResourceCost(option) {
  return Boolean(option.cost?.resource || option.resource);
}

function isAttackOption(option) {
  return option.rolls?.some((roll) => roll.type === "attack" || roll.id === "attack");
}

function isAreaOption(option) {
  return AREA_TERMS.test(optionText(option));
}

function optionRangeBand(option) {
  const type = option.range?.type ?? "";
  if (type === "melee" || /\btouch\b/i.test(String(option.spell?.range))) return "melee";

  const range = rangeFeet(option);
  if (range > 0 && range <= 5 && type !== "ranged") return "melee";
  if (range > 0 && range < 30) return "near";
  if (range >= 30 && range <= 90) return "long";
  if (range > 90) return "far";
  if (type === "ranged") return "long";
  return "unknown";
}

function rangeFeet(option) {
  const explicit = Number(option.range?.normal ?? 0);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const text = [option.range?.label, option.spell?.range].filter(Boolean).join(" ");
  const match = String(text).match(/(\d+)\s*(?:feet|foot|ft\.?)/i);
  return match ? Number(match[1]) : 0;
}

function capitalize(value) {
  const text = String(value ?? "");
  return text ? `${text[0].toUpperCase()}${text.slice(1)}` : "";
}

function averageFormula(formula) {
  const text = String(formula ?? "");
  let total = 0;
  for (const match of text.matchAll(/(\d*)d(\d+)/gi)) {
    const count = Number(match[1] || 1);
    const sides = Number(match[2]);
    total += count * ((sides + 1) / 2);
  }
  for (const match of text.matchAll(/(^|[^\dd])([+-]\s*\d+)\b/g)) {
    total += Number(match[2].replace(/\s+/g, ""));
  }
  if (!total) total = Number(text.match(/^\d+$/)?.[0] ?? 0);
  return Math.max(0, total);
}

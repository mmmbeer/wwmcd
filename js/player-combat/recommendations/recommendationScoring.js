const DEFAULT_ANSWERS = {
  goal: "balanced",
  situation: "single",
  distance: "unknown",
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

export function getDefaultRecommendationAnswers() {
  return { ...DEFAULT_ANSWERS };
}

export function getRecommendationQuestionConfig(groups, answers = DEFAULT_ANSWERS) {
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
        ["near", "Near"],
        ["far", "Far"]
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
    value: answers[question.id] ?? DEFAULT_ANSWERS[question.id]
  }));
}

export function getRankedRecommendations({ groups, character, combatState, answers = {} }) {
  const resolvedAnswers = { ...DEFAULT_ANSWERS, ...answers };
  const options = collectOptions(groups);
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
  applyRollModeAdjustments(categoryScores, option, context.answers);
  applyConcentrationAdjustments(categoryScores, option, context);

  const weights = GOAL_WEIGHTS[context.answers.goal] ?? GOAL_WEIGHTS.balanced;
  const weighted = Object.entries(weights).reduce((total, [key, weight]) => total + categoryScores[key] * weight, 0);
  const availability = option.available === false ? -140 : 25;
  const base = option.recommended ? 8 : 0;
  const score = Math.round(weighted + categoryScores.resourceFit + availability + base);

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
      if (option?.id && !byId.has(option.id)) byId.set(option.id, option);
    }
  }
  return [...byId.values()];
}

function damageScore(option, context) {
  const damageRolls = option.rolls?.filter((roll) => roll.type === "damage" || roll.id === "damage") ?? [];
  const average = damageRolls.reduce((total, roll) => total + averageFormula(roll.formula), 0);
  let score = Math.min(60, average * 4);
  if (option.rolls?.some((roll) => roll.type === "attack" || roll.id === "attack")) score += 8;
  if (AREA_TERMS.test(optionText(option))) score += context.answers.situation === "multiple" ? 18 : 4;
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

function applySituationAdjustments(scores, option, context) {
  if (context.answers.situation === "ally") scores.support += 28;
  if (context.answers.situation === "self") scores.defense += 26;
  if (context.answers.situation === "multiple" && AREA_TERMS.test(optionText(option))) {
    scores.damage += 14;
    scores.control += 12;
  }
}

function applyDistanceAdjustments(scores, option, answers) {
  const type = option.range?.type ?? "";
  const range = Number(option.range?.normal ?? 0);
  if (answers.distance === "melee" && type === "melee") scores.damage += 12;
  if (answers.distance === "melee" && type === "ranged") scores.damage -= 10;
  if (answers.distance === "far" && (type === "ranged" || range >= 60 || /feet|ft/i.test(String(option.spell?.range)))) scores.damage += 12;
  if (answers.distance === "far" && type === "melee") scores.damage -= 12;
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
  if (scores.damage >= 30) reasons.push("High damage");
  if (scores.support >= 28) reasons.push("Strong support");
  if (scores.control >= 28) reasons.push("Control option");
  if (scores.defense >= 28) reasons.push("Defensive fit");
  if (scores.mobility >= 28) reasons.push("Improves position");
  if (!option.cost?.resource && !option.resource) reasons.push("No resource cost");
  if (option.cost?.bonus) reasons.push("Uses bonus action");
  if (option.cost?.reaction) reasons.push("Reaction option");
  if (context.answers.resources === "spend" && (option.cost?.resource || option.resource)) reasons.push("Resource spend fits");
  if (option.available === false) reasons.push("Currently unavailable");
  return [...new Set(reasons)].slice(0, 4);
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

import { validateSeedPlans } from "./aiSeedPlanBuilder.js";

export function buildTacticalCandidatePackage({ availableOptions = {}, optionIndex = [], deterministicSeedPlans = [], playerIntent = {} } = {}) {
  const piecesBySlot = {
    action: candidatePieces(optionIndex, (option) => option.cost?.action),
    bonusAction: candidatePieces(optionIndex, (option) => option.cost?.bonus),
    rider: candidatePieces(optionIndex, (option) => isRider(option)),
    movement: candidatePieces(optionIndex, (option) => option.cost?.movement),
    freeObjectInteraction: candidatePieces(optionIndex, (option) => option.cost?.object),
    reaction: candidatePieces(optionIndex, (option) => option.cost?.reaction),
    resourceSpend: candidatePieces(optionIndex, (option) => option.cost?.resource || option.resource)
  };
  const validatedSeedPlans = validateSeedPlans(deterministicSeedPlans, optionIndex).plans;
  const candidatePackage = pruneEmpty({
    goal: playerIntent.goal,
    completeTurnSlots: ["action", "bonusAction", "rider", "movement", "freeObjectInteraction", "reaction", "resourceSpend"],
    piecesBySlot,
    allGoalRelevantSpells: goalRelevantSpells(optionIndex, playerIntent),
    instruction: "Use these as candidate material only; every actionable plan piece must match optionIndex exactly. availableOptions is only a grouping aid."
  });
  return { ...candidatePackage, deterministicSeedPlans: validatedSeedPlans };
}

function candidatePieces(options, predicate) {
  return (options ?? [])
    .filter((option) => option.available !== false && predicate(option))
    .map((option) => summarizeCandidate(option))
    .slice(0, 40);
}

function goalRelevantSpells(options, playerIntent) {
  return (options ?? [])
    .filter((option) => option?.isSpell && option.available !== false)
    .map((option) => summarizeCandidate(option))
    .slice(0, 80);
}

function summarizeCandidate(option) {
  return pruneEmpty({
    optionId: option.id,
    name: option.name,
    group: option.group,
    slot: slotForOption(option),
    cost: option.cost,
    resource: option.resource,
    tacticalCategories: tacticalCategories(option),
    tags: option.tags,
    range: option.range,
    damageTypes: option.damageTypes,
    spell: option.isSpell ? {
      level: option.spellLevel,
      concentration: option.concentration,
      saveAbility: option.saveAbility,
      requiresSave: option.requiresSave
    } : null
  });
}

function tacticalCategories(option) {
  const categories = new Set([
    ...(option.tactics?.roles ?? []),
    ...(option.tags ?? []),
    ...(option.concentration ? ["concentration"] : []),
    ...(option.cost?.resource || option.resource ? ["resourceSpend"] : []),
    ...(option.rolls?.some((roll) => roll.type === "attack" || roll.id === "attack") ? ["saveOrAttack"] : []),
    ...(option.requiresSave || option.saveAbility ? ["saveOrAttack"] : []),
    ...(option.rolls?.some((roll) => roll.type === "damage" || roll.id === "damage") ? ["damage"] : [])
  ]);
  const text = `${option.name ?? ""} ${option.summary ?? ""} ${option.description ?? ""}`.toLowerCase();
  if (/\b(area|cone|cube|sphere|radius|line)\b/.test(text)) categories.add("area");
  if (/\b(single target|one target|a target|one creature)\b/.test(text)) categories.add("singleTarget");
  if (/\b(rider|when you hit|on a hit)\b/.test(text)) categories.add("rider");
  if (/\b(advantage|mark|hex|setup|prepare)\b/.test(text)) categories.add("setup");
  if (option.cost?.reaction) categories.add("reaction");
  return [...categories].slice(0, 12);
}

function isRider(option) {
  const text = `${option.name ?? ""} ${option.summary ?? ""} ${(option.tags ?? []).join(" ")}`;
  return /\b(rider|sneak attack|divine smite|stunning strike|when you hit|on a hit)\b/i.test(text)
    && !option.cost?.action
    && !option.cost?.bonus
    && !option.cost?.reaction;
}

function slotForOption(option) {
  if (option.cost?.action) return "Action";
  if (option.cost?.bonus) return "Bonus Action";
  if (option.cost?.reaction) return "Reaction";
  if (option.cost?.movement) return "Movement";
  if (option.cost?.object) return "Free/Object Interaction";
  if (isRider(option)) return "Rider";
  return "Special";
}

function pruneEmpty(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => {
    if (entry == null || entry === "") return false;
    if (Array.isArray(entry)) return entry.length > 0;
    if (typeof entry === "object") return Object.keys(entry).length > 0;
    return true;
  }));
}

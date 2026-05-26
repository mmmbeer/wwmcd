const CANDIDATE_GROUPS = ["attacks", "actions", "spells", "bonus", "reaction", "free", "movement", "resources"];

export function buildTacticalCandidatePackage({ availableOptions = {}, deterministicRecommendations = [], playerIntent = {} } = {}) {
  const piecesBySlot = {
    action: candidatePieces(availableOptions, (option) => option.cost?.action || ["attacks", "actions", "spells"].includes(option.group)),
    bonusAction: candidatePieces(availableOptions, (option) => option.cost?.bonus || option.spell?.castingCost === "bonus"),
    rider: candidatePieces(availableOptions, (option) => isRider(option)),
    movement: candidatePieces(availableOptions, (option) => option.cost?.movement || option.group === "movement"),
    freeObjectInteraction: candidatePieces(availableOptions, (option) => option.cost?.object || option.group === "free"),
    reaction: candidatePieces(availableOptions, (option) => option.cost?.reaction || option.group === "reaction"),
    resourceSpend: candidatePieces(availableOptions, (option) => option.cost?.resource || option.resource || option.group === "resources")
  };
  return pruneEmpty({
    goal: playerIntent.goal,
    completeTurnSlots: ["action", "bonusAction", "rider", "movement", "freeObjectInteraction", "reaction", "resourceSpend"],
    piecesBySlot,
    allGoalRelevantSpells: goalRelevantSpells(availableOptions, playerIntent),
    deterministicSeedPlans: deterministicRecommendations,
    instruction: "Use this as candidate material only; every actionable plan piece must still match optionIndex exactly."
  });
}

function candidatePieces(groups, predicate) {
  return Object.entries(groups ?? {})
    .flatMap(([group, options]) => (options ?? []).map((option) => ({ ...option, group: option.group || group })))
    .filter((option) => option.available !== false && predicate(option))
    .map((option) => summarizeCandidate(option))
    .slice(0, 40);
}

function goalRelevantSpells(groups, playerIntent) {
  return Object.values(groups ?? {}).flat()
    .filter((option) => option?.spell && option.available !== false)
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
    spell: option.spell ? {
      level: option.spell.level,
      castingCost: option.spell.castingCost,
      concentration: option.spell.concentration,
      saveAbility: option.spell.saveAbility,
      requiresSave: option.spell.requiresSave
    } : null
  });
}

function tacticalCategories(option) {
  const categories = new Set([
    ...(option.tactics?.roles ?? []),
    ...(option.tags ?? []),
    ...(option.spell?.concentration ? ["concentration"] : []),
    ...(option.cost?.resource || option.resource ? ["resourceSpend"] : []),
    ...(option.rolls?.some((roll) => roll.type === "attack" || roll.id === "attack") ? ["saveOrAttack"] : []),
    ...(option.spell?.requiresSave || option.spell?.saveAbility ? ["saveOrAttack"] : []),
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
  if (option.cost?.movement || option.group === "movement") return "Move";
  if (option.cost?.object || option.group === "free") return "Free/Object Interaction";
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

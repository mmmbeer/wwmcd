const CONTEXT_JSON_BUDGET = 18000;

export function compactContextForRequest(context, budget = CONTEXT_JSON_BUDGET) {
  if (JSON.stringify(context).length <= budget) return context;

  const compact = buildCompactContext(context, {
    availableLimit: 18,
    unavailableLimit: 8,
    optionSummaryLimit: 180,
    listLimit: 20
  });
  if (JSON.stringify(compact).length <= budget) return compact;

  const tighter = buildCompactContext(context, {
    availableLimit: 10,
    unavailableLimit: 4,
    optionSummaryLimit: 90,
    listLimit: 10
  });
  if (JSON.stringify(tighter).length <= budget) return tighter;

  return buildCompactContext(context, {
    availableLimit: 6,
    unavailableLimit: 3,
    optionSummaryLimit: 45,
    listLimit: 6
  });
}

function buildCompactContext(context, { availableLimit, unavailableLimit, optionSummaryLimit, listLimit }) {
  const availableOptions = compactOptionIdsByGroup(context?.availableOptions, availableLimit);
  const optionIndex = buildCompactOptionIndex(context?.availableOptions, availableLimit, optionSummaryLimit);
  return pruneEmpty({
    schemaVersion: context?.schemaVersion,
    character: compactCharacter(context?.character, listLimit),
    combatState: context?.combatState,
    turnRules: context?.turnRules,
    playerIntent: context?.playerIntent,
    selectedCreatures: compactSelectedCreatures(context?.selectedCreatures),
    battlefieldKnowledge: compactBattlefieldKnowledge(context?.battlefieldKnowledge),
    rankingGuidance: compactRankingGuidance(context?.rankingGuidance),
    classTactics: compactClassTactics(context?.classTactics),
    availableOptions,
    unavailableOptions: compactUnavailableOptionGroups(context?.unavailableOptions, unavailableLimit),
    optionIndex,
    optionAudit: compactOptionAudit(context?.optionAudit),
    deterministicRecommendations: (context?.deterministicRecommendations ?? []).slice(0, 3).map(compactRecommendationSet),
    requestNotes: {
      contextCompacted: true,
      compactReason: "Original tactical context exceeded request payload budget.",
      availableOptionsShape: "grouped option id lists; use optionIndex for candidate details"
    }
  });
}

function compactOptionAudit(audit = {}) {
  return pruneEmpty({
    dataWarnings: compactStrings(audit.dataWarnings, 8),
    ignoredDeterministicRecommendations: compactStrings(audit.ignoredDeterministicRecommendations, 8),
    candidateDowngrades: compactStrings(audit.candidateDowngrades, 8),
    highValueTacticalHooks: compactStrings(audit.highValueTacticalHooks, 8)
  });
}

function compactClassTactics(classTactics = {}) {
  return Object.fromEntries(Object.entries(classTactics ?? {}).map(([className, tactics]) => [
    className,
    {
      priorities: compactList(tactics?.priorities, 3),
      checks: compactList(tactics?.checks, 3),
      avoid: compactList(tactics?.avoid, 2),
      reminderQuestions: compactList(tactics?.reminderQuestions, 3)
    }
  ]));
}

function compactBattlefieldKnowledge(knowledge = {}) {
  return pruneEmpty({
    inferredCreatures: compactNames(knowledge.inferredCreatures, 4),
    avoidDamageTypes: knowledge.avoidDamageTypes,
    impactedOptionIds: uniqueStrings((knowledge.impactedOptions ?? []).map((option) => option.id)).slice(0, 12),
    inferencePolicy: "Common lore assumptions from user notes; DM variants may differ."
  });
}

function compactRankingGuidance(guidance = {}) {
  return pruneEmpty({
    highPriorityOptions: compactGuidanceOptions(guidance.highPriorityOptions, 8),
    avoidOptions: compactGuidanceOptions(guidance.avoidOptions, 8),
    fullTurnPlanning: guidance.fullTurnPlanning,
    rangeTactics: guidance.rangeTactics
  });
}

function compactSelectedCreatures(creatures = []) {
  if (!Array.isArray(creatures)) return [];
  return creatures.slice(0, 3).map((creature) => pruneEmpty({
    name: creature.name,
    type: creature.type,
    ac: creature.ac,
    hp: creature.hp,
    cr: creature.cr,
    stats: creature.stats,
    saves: creature.saves,
    skills: creature.skills,
    senses: creature.senses,
    speed: creature.speed,
    vulnerabilities: creature.vulnerabilities,
    resistances: creature.resistances,
    immunities: creature.immunities,
    conditionImmunities: creature.conditionImmunities,
    traits: compactList(creature.traits, 5),
    actions: compactList(creature.actions, 6),
    bonusActions: compactList(creature.bonusActions, 3),
    reactions: compactList(creature.reactions, 3),
    legendaryActions: compactList(creature.legendaryActions, 4)
  }));
}

function compactGuidanceOptions(options = [], limit) {
  if (!Array.isArray(options)) return [];
  return options.slice(0, limit).map((option) => pruneEmpty({
    id: option.id,
    name: option.name,
    damageTypes: option.damageTypes,
    reason: option.reason
  }));
}

function compactCharacter(character, listLimit) {
  if (!character) return null;
  return pruneEmpty({
    name: character.name,
    level: character.level,
    race: character.race,
    classes: character.classes,
    stats: character.stats,
    combat: compactCombat(character.combat),
    resources: compactResources(character.resources),
    features: compactRecordNames(character.features, Math.min(8, listLimit)),
    traits: compactNames(character.traits, Math.min(8, listLimit)),
    equipment: compactEquipment(character.equipment, Math.min(8, listLimit)),
    spells: compactSpells(character.spells)
  });
}

function compactCombat(combat = {}) {
  return pruneEmpty({
    maxHp: combat.maxHp,
    currentHp: combat.currentHp,
    tempHp: combat.tempHp,
    ac: combat.ac,
    initiativeBonus: combat.initiativeBonus,
    proficiencyBonus: combat.proficiencyBonus,
    speed: compactSpeed(combat.speed),
    conditions: combat.conditions,
    concentration: combat.concentration
  });
}

function compactSpeed(speed = {}) {
  return pruneEmpty({
    walk: speed.walk,
    climb: speed.climb || undefined,
    swim: speed.swim || undefined,
    fly: speed.fly || undefined,
    burrow: speed.burrow || undefined
  });
}

function compactResources(resources = {}) {
  return pruneEmpty({
    spellSlots: resources.spellSlots,
    classResources: compactList(resources.classResources, 12),
    limitedUses: compactList(resources.limitedUses, 12)
  });
}

function compactEquipment(equipment = {}, limit) {
  return pruneEmpty({
    weapons: compactList(equipment.weapons, limit),
    armor: compactNames(equipment.armor, limit),
    consumables: compactNames(equipment.consumables, limit),
    magicItems: compactNames(equipment.magicItems, limit)
  });
}

function compactSpells(spells = {}) {
  return pruneEmpty({
    spellcastingAbility: spells.spellcastingAbility,
    attackBonus: spells.attackBonus,
    saveDc: spells.saveDc
  });
}

function compactRecordNames(record = {}, listLimit) {
  return pruneEmpty(Object.fromEntries(Object.entries(record ?? {}).map(([key, value]) => [key, compactNames(value, listLimit)])));
}

function compactNames(items = [], limit) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, limit).map((item) => typeof item === "string" ? item : item?.name).filter(Boolean);
}

function compactList(items = [], limit) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, limit).map((item) => {
    if (typeof item === "string") return item;
    return {
      name: item.name,
      level: item.level,
      prepared: item.prepared,
      equipped: item.equipped,
      quantity: item.quantity,
      damage: item.damage?.diceString ?? item.damage,
      damageType: item.damageType,
      summary: item.summary,
      max: item.max,
      reset: item.reset,
      note: item.note
    };
  });
}

function compactOptionIdsByGroup(groups = {}, limit) {
  return pruneEmpty(Object.fromEntries(Object.entries(groups ?? {}).map(([group, options]) => [
    group,
    uniqueById(options ?? []).slice(0, limit).map((option) => option.id).filter(Boolean)
  ])));
}

function compactUnavailableOptionGroups(groups = {}, limit) {
  return pruneEmpty(Object.fromEntries(Object.entries(groups ?? {}).map(([group, options]) => [
    group,
    uniqueById(options ?? []).slice(0, limit).map((option) => pruneEmpty({
      id: option.id,
      name: option.name,
      reasons: option.unavailableReasons
    }))
  ])));
}

function compactOption(option, summaryLimit) {
  return pruneEmpty({
    id: option.id,
    name: option.name,
    source: option.source,
    group: option.group,
    available: option.available !== false,
    unavailableReasons: option.unavailableReasons ?? [],
    cost: option.cost,
    resource: option.resource,
    attack: option.attack,
    range: compactRange(option.range),
    rolls: compactRolls(option.rolls),
    damageTypes: option.damageTypes,
    tags: option.tags,
    spell: compactSpellOption(option.spell),
    summary: trimText(option.summary, summaryLimit)
  });
}

function compactRange(range) {
  if (!range) return undefined;
  if (typeof range === "string") return range;
  return pruneEmpty({
    type: range.type,
    label: range.label,
    normal: range.normal,
    long: range.long
  });
}

function compactRolls(rolls = []) {
  if (!Array.isArray(rolls)) return [];
  return rolls.map((roll) => pruneEmpty({
    id: roll.id,
    formula: roll.formula,
    type: roll.type,
    damageType: roll.damageType
  }));
}

function compactSpellOption(spell) {
  if (!spell) return undefined;
  return pruneEmpty({
    level: spell.level,
    castingCost: spell.castingCost,
    concentration: spell.concentration || undefined,
    range: spell.range,
    saveAbility: spell.saveAbility
  });
}

function buildCompactOptionIndex(groups = {}, limit, summaryLimit) {
  const options = [];
  Object.entries(groups ?? {}).forEach(([group, groupOptions]) => {
    uniqueById(groupOptions ?? []).slice(0, limit).forEach((option) => {
      options.push(compactOption({ ...option, group }, summaryLimit));
    });
  });
  return uniqueById(options);
}

function uniqueById(options = []) {
  const seen = new Set();
  return options.filter((option) => {
    if (!option?.id || seen.has(option.id)) return false;
    seen.add(option.id);
    return true;
  });
}

function compactStrings(items = [], limit) {
  return Array.isArray(items) ? items.filter((item) => typeof item === "string").slice(0, limit) : [];
}

function compactRecommendationSet(set) {
  return pruneEmpty({
    rank: set.rank,
    title: set.title,
    score: set.score,
    optionIds: uniqueStrings((set.pieces ?? []).map((piece) => piece.option?.id)).slice(0, 6),
    reasons: compactStrings(set.reasons, 3),
    warnings: compactStrings(set.warnings, 3)
  });
}

function uniqueStrings(items = []) {
  return [...new Set(items.filter((item) => typeof item === "string" && item.trim()))];
}

function pruneEmpty(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => {
      if (entry == null || entry === "" || entry === false) return false;
      if (Array.isArray(entry)) return entry.length > 0;
      if (typeof entry === "object") return Object.keys(entry).length > 0;
      return true;
    })
  );
}

function trimText(value, max) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

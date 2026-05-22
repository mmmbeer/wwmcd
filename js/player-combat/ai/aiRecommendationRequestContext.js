const CONTEXT_JSON_BUDGET = 24000;

export function compactContextForRequest(context, budget = CONTEXT_JSON_BUDGET) {
  if (JSON.stringify(context).length <= budget) return context;

  const compact = buildCompactContext(context, {
    availableLimit: 18,
    unavailableLimit: 8,
    optionSummaryLimit: 180,
    listLimit: 20
  });
  if (JSON.stringify(compact).length <= budget) return compact;

  return buildCompactContext(context, {
    availableLimit: 10,
    unavailableLimit: 4,
    optionSummaryLimit: 90,
    listLimit: 10
  });
}

function buildCompactContext(context, { availableLimit, unavailableLimit, optionSummaryLimit, listLimit }) {
  return {
    schemaVersion: context?.schemaVersion,
    character: compactCharacter(context?.character, listLimit),
    combatState: context?.combatState,
    turnRules: context?.turnRules,
    playerIntent: context?.playerIntent,
    classTactics: context?.classTactics,
    availableOptions: compactOptionGroups(context?.availableOptions, availableLimit, optionSummaryLimit),
    unavailableOptions: compactOptionGroups(context?.unavailableOptions, unavailableLimit, 80),
    optionIndex: (context?.optionIndex ?? []).slice(0, availableLimit * 8).map(compactIndexOption),
    deterministicRecommendations: (context?.deterministicRecommendations ?? []).slice(0, 3).map(compactRecommendationSet),
    instructionHints: context?.instructionHints,
    requestNotes: {
      contextCompacted: true,
      compactReason: "Original tactical context exceeded request payload budget."
    }
  };
}

function compactCharacter(character, listLimit) {
  if (!character) return null;
  return {
    name: character.name,
    level: character.level,
    race: character.race,
    classes: character.classes,
    stats: character.stats,
    combat: character.combat,
    resources: character.resources,
    features: compactRecordLists(character.features, listLimit),
    traits: compactList(character.traits, listLimit),
    equipment: compactRecordLists(character.equipment, listLimit),
    spells: compactSpells(character.spells, listLimit)
  };
}

function compactSpells(spells = {}, listLimit) {
  return {
    spellcastingAbility: spells.spellcastingAbility,
    attackBonus: spells.attackBonus,
    saveDc: spells.saveDc,
    cantrips: compactList(spells.cantrips, listLimit),
    prepared: compactList(spells.prepared, listLimit * 2),
    known: compactList(spells.known, listLimit * 2)
  };
}

function compactRecordLists(record = {}, listLimit) {
  return Object.fromEntries(Object.entries(record ?? {}).map(([key, value]) => [key, compactList(value, listLimit)]));
}

function compactList(items = [], limit) {
  return (items ?? []).slice(0, limit).map((item) => {
    if (typeof item === "string") return item;
    return {
      name: item.name,
      level: item.level,
      prepared: item.prepared,
      equipped: item.equipped,
      quantity: item.quantity,
      damage: item.damage,
      damageType: item.damageType,
      max: item.max,
      reset: item.reset,
      note: item.note
    };
  });
}

function compactOptionGroups(groups = {}, limit, summaryLimit) {
  return Object.fromEntries(Object.entries(groups ?? {}).map(([group, options]) => [
    group,
    (options ?? []).slice(0, limit).map((option) => compactOption(option, summaryLimit))
  ]));
}

function compactOption(option, summaryLimit) {
  return {
    id: option.id,
    name: option.name,
    source: option.source,
    group: option.group,
    available: option.available !== false,
    unavailableReasons: option.unavailableReasons ?? [],
    cost: option.cost,
    resource: option.resource,
    attack: option.attack,
    range: option.range,
    rolls: option.rolls,
    tags: option.tags,
    spell: option.spell,
    summary: trimText(option.summary, summaryLimit)
  };
}

function compactIndexOption(option) {
  return {
    id: option.id,
    name: option.name,
    group: option.group,
    cost: option.cost,
    resource: option.resource,
    tags: option.tags,
    isSpell: option.isSpell,
    spellLevel: option.spellLevel,
    concentration: option.concentration
  };
}

function compactRecommendationSet(set) {
  return {
    rank: set.rank,
    title: set.title,
    score: set.score,
    pieces: (set.pieces ?? []).map((piece) => ({
      slot: piece.slot,
      option: compactOption(piece.option ?? {}, 80),
      reasons: piece.reasons ?? [],
      warnings: piece.warnings ?? []
    })),
    reasons: set.reasons ?? [],
    warnings: set.warnings ?? []
  };
}

function trimText(value, max) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

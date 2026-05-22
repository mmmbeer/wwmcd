import { CLASS_TACTICS } from "./classTactics.js";

const OPTION_GROUPS = ["attacks", "actions", "spells", "bonus", "reaction", "free", "movement", "resources"];

export function buildAiRecommendationContext({ snapshot, groups, recommendationSets, answers, userNotes }) {
  const character = snapshot.activeCharacter;
  const combatState = snapshot.combatState;
  const availableOptions = summarizeGroups(groups);
  return {
    schemaVersion: "combat-turn-recommendation/v2",
    character: summarizeCharacter(character),
    combatState: summarizeCombatState(combatState, character),
    turnRules: buildTurnRules(character, combatState),
    playerIntent: summarizePlayerIntent(answers, userNotes),
    classTactics: summarizeClassTactics(character),
    availableOptions,
    unavailableOptions: summarizeUnavailableGroups(groups),
    optionIndex: buildOptionIndex(availableOptions),
    deterministicRecommendations: recommendationSets.slice(0, 5).map(summarizeRecommendationSet),
    instructionHints: {
      useOnlyOptionIds: true,
      preferCompleteTurnPlans: true,
      markMissingInfoExplicitly: true,
      doNotInventEnemyStats: true,
      unavailableOptionsAreForAwarenessOnly: true
    }
  };
}

export function summarizeClassTactics(character) {
  const classNames = (character?.classes ?? [])
    .map((entry) => normalizeClassName(entry?.name))
    .filter(Boolean);

  return Object.fromEntries(
    [...new Set(classNames)]
      .filter((className) => CLASS_TACTICS[className])
      .map((className) => [className, CLASS_TACTICS[className]])
  );
}

export function buildTurnRules(character, combatState) {
  return {
    actionEconomy: {
      maxActions: 1,
      maxBonusActions: 1,
      maxReactions: 1,
      movementAvailable: character?.combat?.speed ?? null,
      freeInteractionAvailable: true
    },
    spellcasting: {
      spellcastingAbility: character?.spells?.spellcastingAbility ?? null,
      spellAttackBonus: character?.spells?.attackBonus ?? null,
      spellSaveDc: character?.spells?.saveDc ?? null,
      currentConcentration: combatState?.current?.concentration ?? null,
      note: "If recommending a concentration spell while already concentrating, warn that the existing concentration may end."
    },
    resourcePolicy: {
      conserveLimitedResourcesUnlessUseful: true,
      doNotSpendUnavailableResources: true,
      explainWhyAnyLimitedResourceIsWorthSpending: true
    },
    legalityPolicy: {
      useOnlyAvailableOptions: true,
      optionsWithAvailableFalseAreConditionalOrUnavailable: true,
      markUncertainRangeLineOfSightOrTargetingAsConditional: true
    }
  };
}

export function summarizePlayerIntent(answers = {}, userNotes) {
  return {
    goal: answers.goal || "best overall turn",
    situation: answers.situation || "",
    range: answers.distance || "",
    difficulty: answers.difficulty || "",
    resourcePreference: answers.resources || "",
    rollPreference: answers.rollMode || "",
    concentrationPreference: answers.concentration || "",
    userNotes: String(userNotes ?? "").trim()
  };
}

export function buildOptionIndex(availableOptions) {
  return Object.entries(availableOptions ?? {}).flatMap(([group, options]) =>
    (options ?? []).map((option) => ({
      id: option.id,
      name: option.name,
      group,
      available: option.available !== false,
      unavailableReasons: option.unavailableReasons ?? [],
      cost: option.cost ?? null,
      resource: option.resource ?? null,
      tags: option.tags ?? [],
      isSpell: Boolean(option.spell),
      spellLevel: option.spell?.level ?? null,
      concentration: option.spell?.concentration ?? false
    }))
  );
}

function summarizeCharacter(character) {
  if (!character) return null;
  return {
    name: character.name,
    level: character.level,
    race: character.race?.name,
    classes: (character.classes ?? []).map((entry) => ({
      name: entry.name,
      subclass: entry.subclass,
      level: entry.level
    })),
    stats: character.stats,
    combat: character.combat,
    resources: summarizeCharacterResources(character),
    features: summarizeFeatureBuckets(character.features),
    traits: summarizeList(character.race?.features, 24),
    equipment: summarizeInventory(character.inventory),
    spells: summarizeSpells(character.spells)
  };
}

function summarizeCombatState(state, character) {
  if (!state) return null;
  return {
    round: state.round,
    hp: {
      current: state.current?.hp,
      max: character?.combat?.maxHp,
      temp: state.current?.tempHp
    },
    ac: state.current?.ac,
    conditions: state.current?.conditions ?? [],
    concentration: state.current?.concentration,
    activeEffects: state.current?.activeEffects ?? [],
    currentForm: state.current?.currentForm,
    turn: state.turn,
    resourcesUsed: state.resourcesUsed,
    lastRoll: state.lastRoll
  };
}

function summarizeCharacterResources(character) {
  return {
    spellSlots: character.resources?.spellSlots ?? {},
    classResources: summarizeList(character.resources?.classResources, 30),
    limitedUses: summarizeList(character.resources?.limitedUses, 30)
  };
}

function summarizeFeatureBuckets(features = {}) {
  return Object.fromEntries(Object.entries(features).map(([key, value]) => [key, summarizeList(value, 35)]));
}

function summarizeInventory(inventory = {}) {
  return {
    weapons: summarizeList(inventory.weapons, 30),
    armor: summarizeList(inventory.armor, 20),
    consumables: summarizeList(inventory.consumables, 25),
    magicItems: summarizeList(inventory.magicItems, 25),
    items: summarizeList(inventory.other, 50)
  };
}

function summarizeSpells(spells = {}) {
  return {
    spellcastingAbility: spells.spellcastingAbility,
    attackBonus: spells.attackBonus,
    saveDc: spells.saveDc,
    cantrips: summarizeList(spells.cantrips, 30),
    prepared: summarizeList(spells.prepared, 80),
    known: summarizeList(spells.known, 100)
  };
}

function summarizeGroups(groups = {}) {
  return Object.fromEntries(OPTION_GROUPS.map((group) => [
    group,
    (groups[group] ?? [])
      .filter((option) => option.available !== false)
      .slice(0, 40)
      .map(summarizeOption)
  ]));
}

export function summarizeUnavailableGroups(groups = {}) {
  return Object.fromEntries(OPTION_GROUPS.map((group) => [
    group,
    (groups[group] ?? [])
      .filter((option) => option.available === false)
      .slice(0, 20)
      .map(summarizeOption)
  ]));
}

function summarizeRecommendationSet(set) {
  return {
    rank: set.rank,
    title: set.title,
    score: set.score,
    pieces: set.pieces.map((piece) => ({
      slot: piece.slot,
      option: summarizeOption(piece.entry.option),
      reasons: piece.entry.reasons ?? [],
      warnings: piece.entry.warnings ?? []
    })),
    reasons: set.reasons,
    warnings: set.warnings
  };
}

function summarizeOption(option) {
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
    rolls: option.rolls ?? [],
    tags: option.tags ?? [],
    meta: option.meta ?? [],
    spell: option.spell ? {
      level: option.spell.level,
      school: option.spell.school,
      castingCost: option.spell.castingCost,
      concentration: option.spell.concentration,
      range: option.spell.range,
      saveAbility: option.spell.saveAbility,
      requiresSave: option.spell.requiresSave
    } : null,
    summary: trimText(
      option.tacticalSummary
        ?? option.description
        ?? option.longDescription
        ?? option.featureAction?.description
        ?? option.spell?.reference?.description,
      350
    )
  };
}

function summarizeList(items = [], max = 20) {
  return (items ?? []).slice(0, max).map((item) => {
    if (typeof item === "string") return item;
    return {
      name: item.name,
      level: item.level,
      prepared: item.prepared,
      equipped: item.equipped,
      quantity: item.quantity,
      damage: item.damage,
      damageType: item.damageType,
      properties: item.properties,
      max: item.max,
      reset: item.reset,
      note: item.note,
      description: trimText(item.description ?? item.snippet ?? item.text, 500)
    };
  });
}

function trimText(value, max) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function normalizeClassName(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z\s-]/g, "")
    .trim()
    .split(/\s+/)[0] ?? "";
}

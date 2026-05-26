import { CLASS_TACTICS } from "./classTactics.js";
import { summarizeSelectedCreatures } from "./creatureContext.js";
import {
  auditRecommendationContext,
  validateDeterministicRecommendations
} from "./aiRecommendationOptionAudit.js";

const OPTION_GROUPS = ["attacks", "actions", "spells", "bonus", "reaction", "free", "movement", "resources"];

export function buildAiRecommendationContext({ snapshot, groups, recommendationSets, answers, userNotes, selectedCreatures = [] }) {
  const character = snapshot.activeCharacter;
  const combatState = snapshot.combatState;
  const availableOptions = summarizeGroups(groups);
  const playerIntent = summarizePlayerIntent(answers, userNotes);
  const battlefieldKnowledge = summarizeBattlefieldKnowledge(playerIntent, availableOptions);
  const optionIndex = buildOptionIndex(availableOptions);
  const rawDeterministicRecommendations = (Array.isArray(recommendationSets) ? recommendationSets : [])
    .slice(0, 5)
    .map(summarizeRecommendationSet);
  const deterministicValidation = validateDeterministicRecommendations(rawDeterministicRecommendations, optionIndex);
  const deterministicRecommendations = deterministicValidation.recommendations;
  const selectedCreatureContext = summarizeSelectedCreatures(selectedCreatures);
  const optionAudit = auditRecommendationContext({
    availableOptions,
    optionIndex,
    deterministicRecommendations: rawDeterministicRecommendations,
    character: summarizeCharacter(character, combatState),
    combatState: summarizeCombatState(combatState, character),
    playerIntent,
    selectedCreatures: selectedCreatureContext
  });
  return pruneEmpty({
    schemaVersion: "combat-option-recommendation/v3",
    character: summarizeCharacter(character, combatState),
    combatState: summarizeCombatState(combatState, character),
    turnRules: buildTurnRules(character, combatState),
    playerIntent,
    selectedCreatures: selectedCreatureContext,
    battlefieldKnowledge,
    rankingGuidance: summarizeRankingGuidance({ availableOptions, battlefieldKnowledge, combatState, playerIntent }),
    classTactics: summarizeClassTactics(character),
    availableOptions,
    unavailableOptions: summarizeUnavailableGroups(groups),
    optionIndex,
    optionAudit: mergeAudit(optionAudit, deterministicValidation.ignored),
    deterministicRecommendations,
    instructionHints: {
      useOnlyOptionIds: true,
      preferCompleteTurnPlans: true,
      markMissingInfoExplicitly: true,
      doNotInventEnemyStats: true,
      useCommonLoreFromUserNotesAsAssumptions: true,
      unavailableOptionsAreForAwarenessOnly: true
    }
  });
}

function mergeAudit(audit, ignoredDeterministicRecommendations) {
  return {
    ...audit,
    ignoredDeterministicRecommendations: [
      ...(audit?.ignoredDeterministicRecommendations ?? []),
      ...(ignoredDeterministicRecommendations ?? [])
    ].filter(Boolean).slice(0, 12)
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
    },
    positioningPolicy: {
      avoidUnnecessaryMeleeForFragileCharacters: true,
      preferEffectiveRangedOptionsWhenCurrentRangeAndLineOfSightSupportThem: true,
      explainAnyRecommendationToMoveCloserOrEnterMelee: true
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
      concentration: option.spell?.concentration ?? false,
      attack: option.attack ?? null,
      range: option.range ?? null,
      rolls: option.rolls ?? [],
      damageTypes: option.damageTypes ?? []
    }))
  );
}

function summarizeCharacter(character, combatState) {
  if (!character) return null;
  return pruneEmpty({
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
    spells: summarizeSpells(character.spells, character, combatState)
  });
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

function summarizeSpells(spells = {}, character, combatState) {
  return pruneEmpty({
    spellcastingAbility: spells.spellcastingAbility,
    attackBonus: spells.attackBonus,
    saveDc: spells.saveDc,
    cantrips: summarizeList(spells.cantrips, 30),
    prepared: summarizeList(filterCastableSpells(spells.prepared, character, combatState), 80),
    known: summarizeList(filterCastableSpells(spells.known, character, combatState), 100)
  });
}

function summarizeGroups(groups = {}) {
  return pruneEmpty(Object.fromEntries(OPTION_GROUPS.map((group) => [
    group,
    prioritizeOptionsForContext((groups[group] ?? []).filter((option) => option.available !== false))
      .slice(0, 40)
      .map(summarizeOption)
  ])));
}

export function summarizeUnavailableGroups(groups = {}) {
  return pruneEmpty(Object.fromEntries(OPTION_GROUPS.map((group) => [
    group,
    (groups[group] ?? [])
      .filter((option) => option.available === false)
      .slice(0, 20)
      .map(summarizeOption)
  ])));
}

function summarizeRecommendationSet(set) {
  const pieces = Array.isArray(set?.pieces) ? set.pieces : [];
  return {
    rank: set?.rank ?? null,
    title: String(set?.title ?? "Untitled recommendation"),
    score: Number(set?.score) || 0,
    pieces: pieces.map((piece) => ({
      slot: String(piece?.slot ?? "Action"),
      option: summarizeOption(piece?.entry?.option ?? piece?.option),
      reasons: Array.isArray(piece?.entry?.reasons) ? piece.entry.reasons : [],
      warnings: Array.isArray(piece?.entry?.warnings) ? piece.entry.warnings : []
    })),
    reasons: Array.isArray(set?.reasons) ? set.reasons : [],
    warnings: Array.isArray(set?.warnings) ? set.warnings : []
  };
}

function summarizeOption(option) {
  const safeOption = option && typeof option === "object" ? option : {};
  const spell = safeOption.spell && typeof safeOption.spell === "object" ? safeOption.spell : null;
  return {
    id: safeOption.id ?? "",
    name: safeOption.name ?? "Unknown option",
    source: safeOption.source ?? "",
    group: safeOption.group ?? "",
    available: safeOption.available !== false,
    unavailableReasons: Array.isArray(safeOption.unavailableReasons) ? safeOption.unavailableReasons : [],
    cost: safeOption.cost ?? null,
    resource: safeOption.resource ?? null,
    attack: safeOption.attack ?? null,
    range: safeOption.range ?? null,
    rolls: Array.isArray(safeOption.rolls) ? safeOption.rolls : [],
    damageTypes: inferDamageTypes(safeOption, spell),
    tags: Array.isArray(safeOption.tags) ? safeOption.tags : [],
    meta: Array.isArray(safeOption.meta) ? safeOption.meta : [],
    spell: spell ? {
      level: spell.level,
      school: spell.school,
      castingCost: spell.castingCost,
      concentration: spell.concentration,
      range: spell.range,
      saveAbility: spell.saveAbility,
      requiresSave: spell.requiresSave
    } : null,
    summary: trimText(
      safeOption.tacticalSummary
        ?? safeOption.description
        ?? safeOption.longDescription
        ?? safeOption.featureAction?.description
        ?? spell?.reference?.description,
      350
    )
  };
}

function filterCastableSpells(spells = [], character, combatState) {
  return (spells ?? []).filter((spell) => {
    const level = normalizeSpellLevel(spell?.level);
    return level === 0 || remainingSpellSlots(character, combatState, level) > 0;
  });
}

function remainingSpellSlots(character, combatState, level) {
  const slots = character?.resources?.spellSlots ?? {};
  const max = spellSlotMax(slots[level]);
  const used = Number(combatState?.resourcesUsed?.spellSlots?.[level] ?? 0);
  return Math.max(0, max - used);
}

function spellSlotMax(value) {
  if (value && typeof value === "object") return Number(value.available ?? value.max ?? value.value ?? 0);
  return Number(value ?? 0);
}

function normalizeSpellLevel(level) {
  if (String(level).toLowerCase() === "cantrip") return 0;
  const numeric = Number(level);
  return Number.isFinite(numeric) ? numeric : 0;
}

function prioritizeOptionsForContext(options) {
  return [...options].sort((left, right) => optionContextPriority(right) - optionContextPriority(left));
}

function optionContextPriority(option) {
  let score = option?.recommended ? 20 : 0;
  if (option?.available === false) score -= 100;
  if (option?.source === "basic") score += 70;
  if (option?.spell) {
    score += 30 + Number(option.spell.level ?? 0) * 8;
    if (option.spell.concentration) score += 3;
  }
  if (option?.cost?.resource || option?.resource) score += 10;
  if (option?.rolls?.some((roll) => roll.type === "damage" || roll.id === "damage")) score += 8;
  if (option?.cost?.action) score += 4;
  if (option?.cost?.bonus) score += 3;
  return score;
}

function summarizeBattlefieldKnowledge(playerIntent, availableOptions) {
  const notes = [playerIntent?.userNotes, playerIntent?.situation].filter(Boolean).join(" ");
  const creatures = inferCreaturesFromText(notes);
  const avoidDamageTypes = [...new Set(creatures.flatMap((creature) => creature.commonAvoidDamageTypes ?? []))];
  const impactedOptions = avoidDamageTypes.length ? optionsWithDamageTypes(availableOptions, avoidDamageTypes) : [];

  return pruneEmpty({
    source: "User tactical notes and common D&D monster lore.",
    inferencePolicy: "Treat these as reasonable assumptions from named creatures, not exact stat blocks. Mention uncertainty when the DM's version may differ.",
    inferredCreatures: creatures,
    avoidDamageTypes,
    impactedOptions
  });
}

function summarizeRankingGuidance({ availableOptions, battlefieldKnowledge, combatState, playerIntent }) {
  const options = Object.values(availableOptions ?? {}).flat();
  const highPriorityOptions = options
    .filter((option) => isOpeningMarkSpell(option, combatState, playerIntent))
    .map((option) => ({
      id: option.id,
      name: option.name,
      reason: "Available bonus-action concentration damage setup; include before attacks against a durable single target when legal."
    }));
  const avoidOptions = Array.isArray(battlefieldKnowledge?.impactedOptions) ? battlefieldKnowledge.impactedOptions : [];

  return pruneEmpty({
    highPriorityOptions,
    avoidOptions,
    fullTurnPlanning: "Rank plans across the whole current turn, including a compatible bonus action when it materially improves the attack plan.",
    rangeTactics: "Use stated distance and each option's range/tags to prefer ranged plans over closing to melee unless closing has a clear benefit."
  });
}

function isOpeningMarkSpell(option, combatState, playerIntent) {
  if (!/\b(hex|hunter'?s mark)\b/i.test(option?.name ?? "")) return false;
  if (!option?.cost?.bonus || !option?.spell?.concentration) return false;
  if (combatState?.current?.concentration) return false;
  return ["single", "bigBad", ""].includes(playerIntent?.situation ?? "");
}

function inferCreaturesFromText(text) {
  const normalized = String(text ?? "").toLowerCase();
  return COMMON_CREATURE_LORE
    .filter((entry) => entry.pattern.test(normalized))
    .map(({ pattern, ...entry }) => entry);
}

function optionsWithDamageTypes(groups, avoidDamageTypes) {
  const avoid = new Set(avoidDamageTypes);
  return Object.values(groups ?? {})
    .flat()
    .filter((option) => (option.damageTypes ?? []).some((type) => avoid.has(type)))
    .slice(0, 12)
    .map((option) => ({
      id: option.id,
      name: option.name,
      damageTypes: option.damageTypes.filter((type) => avoid.has(type))
    }));
}

function inferDamageTypes(option, spell) {
  const explicit = [
    option.damageType,
    option.damage?.type,
    ...(Array.isArray(option.rolls) ? option.rolls.map((roll) => roll.damageType ?? roll.typeLabel) : [])
  ];
  const text = [
    ...explicit,
    option.name,
    option.description,
    option.longDescription,
    option.featureAction?.description,
    spell?.reference?.description
  ].filter(Boolean).join(" ");
  return DAMAGE_TYPES.filter((type) => new RegExp(`\\b${type}\\b`, "i").test(text));
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

function pruneEmpty(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => {
    if (entry == null || entry === "") return false;
    if (Array.isArray(entry)) return entry.length > 0;
    if (typeof entry === "object") return Object.keys(entry).length > 0;
    return true;
  }));
}

function normalizeClassName(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z\s-]/g, "")
    .trim()
    .split(/\s+/)[0] ?? "";
}

const DAMAGE_TYPES = ["acid", "cold", "fire", "force", "lightning", "necrotic", "poison", "psychic", "radiant", "thunder"];

const COMMON_CREATURE_LORE = [
  { name: "red dragon", pattern: /\bred\s+dragon\b/, commonAvoidDamageTypes: ["fire"], note: "Red dragons are commonly fire-immune." },
  { name: "gold dragon", pattern: /\bgold\s+dragon\b/, commonAvoidDamageTypes: ["fire"], note: "Gold dragons are commonly fire-immune." },
  { name: "brass dragon", pattern: /\bbrass\s+dragon\b/, commonAvoidDamageTypes: ["fire"], note: "Brass dragons are commonly fire-immune." },
  { name: "blue dragon", pattern: /\bblue\s+dragon\b/, commonAvoidDamageTypes: ["lightning"], note: "Blue dragons are commonly lightning-immune." },
  { name: "bronze dragon", pattern: /\bbronze\s+dragon\b/, commonAvoidDamageTypes: ["lightning"], note: "Bronze dragons are commonly lightning-immune." },
  { name: "green dragon", pattern: /\bgreen\s+dragon\b/, commonAvoidDamageTypes: ["poison"], note: "Green dragons are commonly poison-immune." },
  { name: "black dragon", pattern: /\bblack\s+dragon\b/, commonAvoidDamageTypes: ["acid"], note: "Black dragons are commonly acid-immune." },
  { name: "copper dragon", pattern: /\bcopper\s+dragon\b/, commonAvoidDamageTypes: ["acid"], note: "Copper dragons are commonly acid-immune." },
  { name: "white dragon", pattern: /\bwhite\s+dragon\b/, commonAvoidDamageTypes: ["cold"], note: "White dragons are commonly cold-immune." },
  { name: "silver dragon", pattern: /\bsilver\s+dragon\b/, commonAvoidDamageTypes: ["cold"], note: "Silver dragons are commonly cold-immune." },
  { name: "fire elemental", pattern: /\bfire\s+elemental\b/, commonAvoidDamageTypes: ["fire", "poison"], note: "Fire elementals commonly ignore fire and poison." },
  { name: "frost giant", pattern: /\bfrost\s+giant\b/, commonAvoidDamageTypes: ["cold"], note: "Frost giants are commonly cold-immune." }
];

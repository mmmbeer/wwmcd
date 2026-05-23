import { addLogEntry, createCombatState, resetTurn } from "../models/combatStateModel.js";
import { isAttackActionOption } from "../rules/attackActionRules.js";
import { getEffectiveWalkSpeed } from "../rules/movementRules.js";
import { resetLongRestResources, resetShortRestResources } from "../rules/restRules.js";

export function createStateManager({ storage, eventBus }) {
  let characters = [];
  let activeCharacterId = null;
  let combatStates = {};
  let referenceData = null;

  function initializeAppState() {
    characters = storage.getCharacters();
    activeCharacterId = storage.getActiveCharacterId() ?? characters[0]?.id ?? null;
    combatStates = storage.getCombatStates();

    if (activeCharacterId && !combatStates[activeCharacterId]) {
      combatStates[activeCharacterId] = createCombatState(getActiveCharacter());
      persistCombatStates();
    }

    emitChange();
  }

  function setReferenceData(data) {
    referenceData = data;
    emitChange();
  }

  function importCharacter(character) {
    const nextCharacters = characters.filter((entry) => entry.id !== character.id);
    characters = [character, ...nextCharacters];
    activeCharacterId = character.id;
    combatStates[character.id] = createCombatState(character);
    persistAll();
    addImportHistory(character);
    emitChange();
  }

  function setActiveCharacter(characterId) {
    if (!characters.some((character) => character.id === characterId)) return;
    activeCharacterId = characterId;
    if (!combatStates[characterId]) {
      combatStates[characterId] = createCombatState(getActiveCharacter());
      persistCombatStates();
    }
    storage.saveActiveCharacterId(activeCharacterId);
    emitChange();
  }

  function getActiveCharacter() {
    return characters.find((character) => character.id === activeCharacterId) ?? null;
  }

  function getCombatState() {
    return activeCharacterId ? combatStates[activeCharacterId] ?? null : null;
  }

  function updateCombatState(patch) {
    const current = getCombatState();
    if (!current) return;
    combatStates[activeCharacterId] = mergeState(current, patch);
    persistCombatStates();
    emitChange();
  }

  function logMessage(message) {
    const state = getCombatState();
    if (!state) return;
    combatStates[activeCharacterId] = addLogEntry(state, message);
    persistCombatStates();
    emitChange();
  }

  function logRoll(result, message) {
    const state = getCombatState();
    if (!state) return;
    combatStates[activeCharacterId] = addLogEntry({ ...state, lastRoll: result }, message, { type: "roll", roll: result });
    persistCombatStates();
    emitChange();
  }

  function resetCombatState(characterId = activeCharacterId) {
    const character = characters.find((entry) => entry.id === characterId);
    if (!character) return;
    combatStates[characterId] = addLogEntry(createCombatState(character), "Combat state reset.");
    persistCombatStates();
    emitChange();
  }

  function startTurn() {
    const state = getCombatState();
    if (!state) return;
    combatStates[activeCharacterId] = addLogEntry({
      ...state,
      turnActive: true,
      turn: resetTurn()
    }, "Turn started.");
    persistCombatStates();
    emitChange();
  }

  function endTurn() {
    const state = getCombatState();
    if (!state) return;
    combatStates[activeCharacterId] = addLogEntry({
      ...state,
      turnActive: false,
      round: state.round + 1,
      turn: resetTurn({ reactionUsed: state.turn.reactionUsed, readiedAction: state.turn.readiedAction })
    }, "Turn ended.");
    persistCombatStates();
    emitChange();
  }

  function useAction() {
    updateTurn({ actionUsed: true }, "Action used.");
  }

  function useBonusAction() {
    updateTurn({ bonusActionUsed: true }, "Bonus action used.");
  }

  function useReaction() {
    updateTurn({ reactionUsed: true }, "Reaction used.");
  }

  function useCombatOption(option) {
    const state = getCombatState();
    if (!state) return;

    combatStates[activeCharacterId] = applyCombatOption(state, option);
    persistCombatStates();
    emitChange();
  }

  function useCombatOptions(options = [], { movementUsed = 0 } = {}) {
    const state = getCombatState();
    const character = getActiveCharacter();
    if (!state) return;

    let next = state;
    for (const option of options.filter(Boolean)) {
      next = applyCombatOption(next, option);
    }

    if (movementUsed > 0 && character) {
      const speed = getEffectiveWalkSpeed(character, referenceData);
      next = addLogEntry({
        ...next,
        turn: {
          ...next.turn,
          movementUsed: clamp((next.turn.movementUsed ?? 0) + Number(movementUsed || 0), 0, speed)
        }
      }, `Movement set to ${clamp((next.turn.movementUsed ?? 0) + Number(movementUsed || 0), 0, speed)} ft.`);
    }

    combatStates[activeCharacterId] = next;
    persistCombatStates();
    emitChange();
  }

  function useMovement(amount) {
    const state = getCombatState();
    const character = getActiveCharacter();
    const speed = getEffectiveWalkSpeed(character, referenceData);
    const movementUsed = clamp((state?.turn.movementUsed ?? 0) + Number(amount || 0), 0, speed);
    if (!state || movementUsed === Number(state.turn?.movementUsed ?? 0)) return;
    combatStates[activeCharacterId] = {
      ...state,
      turn: { ...state.turn, movementUsed }
    };
    persistCombatStates();
    emitChange();
  }

  function setSpellSlotUsed(level, used) {
    const state = getCombatState();
    const character = getActiveCharacter();
    if (!state || !character) return;
    const slotLevel = String(level);
    const max = spellSlotMax(character.resources?.spellSlots?.[slotLevel]);
    const nextUsed = clamp(Number(used || 0), 0, max);
    combatStates[activeCharacterId] = addLogEntry({
      ...state,
      resourcesUsed: {
        ...state.resourcesUsed,
        spellSlots: {
          ...(state.resourcesUsed?.spellSlots ?? {}),
          [slotLevel]: nextUsed
        }
      }
    }, `Level ${slotLevel} spell slots used set to ${nextUsed}.`);
    persistCombatStates();
    emitChange();
  }

  function adjustSpellSlotUsed(level, delta) {
    const current = Number(getCombatState()?.resourcesUsed?.spellSlots?.[level] ?? 0);
    setSpellSlotUsed(level, current + Number(delta || 0));
  }

  function resetSpellSlots(level = null) {
    const state = getCombatState();
    if (!state) return;
    const spellSlots = level === null ? {} : { ...(state.resourcesUsed?.spellSlots ?? {}), [String(level)]: 0 };
    combatStates[activeCharacterId] = addLogEntry({
      ...state,
      resourcesUsed: {
        ...state.resourcesUsed,
        spellSlots
      }
    }, level === null ? "Spell slots reset." : `Level ${level} spell slots reset.`);
    persistCombatStates();
    emitChange();
  }

  function setClassResourceUsed(resourceId, used) {
    const state = getCombatState();
    const character = getActiveCharacter();
    if (!state || !character) return;
    const resource = findClassResource(character, resourceId);
    if (!resource) return;
    const nextUsed = clamp(Number(used || 0), 0, resource.max);
    combatStates[activeCharacterId] = addLogEntry({
      ...state,
      resourcesUsed: {
        ...state.resourcesUsed,
        classResources: {
          ...(state.resourcesUsed?.classResources ?? {}),
          [resource.id]: nextUsed
        }
      }
    }, `${resource.name} used set to ${nextUsed}.`);
    persistCombatStates();
    emitChange();
  }

  function adjustClassResourceUsed(resourceId, delta) {
    const current = Number(getCombatState()?.resourcesUsed?.classResources?.[resourceId] ?? 0);
    setClassResourceUsed(resourceId, current + Number(delta || 0));
  }

  function resetClassResources(resourceId = null) {
    const state = getCombatState();
    if (!state) return;
    const classResources = resourceId === null
      ? {}
      : { ...(state.resourcesUsed?.classResources ?? {}), [resourceId]: 0 };
    combatStates[activeCharacterId] = addLogEntry({
      ...state,
      resourcesUsed: {
        ...state.resourcesUsed,
        classResources
      }
    }, resourceId === null ? "Limited resources reset." : "Limited resource reset.");
    persistCombatStates();
    emitChange();
  }

  function takeShortRest() {
    const state = getCombatState();
    const character = getActiveCharacter();
    if (!state || !character) return;
    combatStates[activeCharacterId] = addLogEntry({
      ...state,
      resourcesUsed: resetShortRestResources(character, state.resourcesUsed)
    }, "Short rest: eligible limited resources reset.");
    persistCombatStates();
    emitChange();
  }

  function takeLongRest() {
    const state = getCombatState();
    const character = getActiveCharacter();
    if (!state || !character) return;
    const maxHp = Number(character.combat?.maxHp ?? 0);
    combatStates[activeCharacterId] = addLogEntry({
      ...state,
      current: {
        ...state.current,
        hp: Number.isFinite(maxHp) ? maxHp : state.current.hp
      },
      resourcesUsed: resetLongRestResources(state.resourcesUsed)
    }, "Long rest: hit points, spell slots, and limited resources reset.");
    persistCombatStates();
    emitChange();
  }

  function updateTurn(patch, message) {
    const state = getCombatState();
    if (!state) return;
    combatStates[activeCharacterId] = addLogEntry({
      ...state,
      turn: { ...state.turn, ...patch }
    }, message);
    persistCombatStates();
    emitChange();
  }

  function persistAll() {
    storage.saveCharacters(characters);
    storage.saveActiveCharacterId(activeCharacterId);
    persistCombatStates();
  }

  function persistCombatStates() {
    storage.saveCombatStates(combatStates);
  }

  function addImportHistory(character) {
    const history = storage.getImportHistory();
    storage.saveImportHistory([
      { characterId: character.id, name: character.name, importedAt: character.importedAt },
      ...history
    ].slice(0, 20));
  }

  function emitChange() {
    eventBus.emit("state:changed", getSnapshot());
  }

  function getSnapshot() {
    return {
      characters,
      activeCharacterId,
      activeCharacter: getActiveCharacter(),
      combatState: getCombatState(),
      referenceData,
      storageAvailable: storage.available
    };
  }

  return {
    initializeAppState,
    setReferenceData,
    importCharacter,
    setActiveCharacter,
    getActiveCharacter,
    getCombatState,
    updateCombatState,
    resetCombatState,
    startTurn,
    endTurn,
    useAction,
    useBonusAction,
    useReaction,
    useCombatOption,
    useCombatOptions,
    useMovement,
    setSpellSlotUsed,
    adjustSpellSlotUsed,
    resetSpellSlots,
    setClassResourceUsed,
    adjustClassResourceUsed,
    resetClassResources,
    takeShortRest,
    takeLongRest,
    logMessage,
    logRoll,
    getSnapshot
  };
}

function applyCombatOption(state, option) {
  const turn = { ...state.turn };
  if (option.cost?.action) turn.actionUsed = true;
  if (option.cost?.bonus) turn.bonusActionUsed = true;
  if (option.cost?.reaction) turn.reactionUsed = true;
  if (option.cost?.object) turn.objectInteractionUsed = true;
  if (isAttackActionOption(option)) turn.attackActionUsed = true;
  if (option.id === "basic_ready") turn.readiedAction = true;
  if (option.id === "basic_use_readied_action") turn.readiedAction = false;
  if (option.effect?.actionSurge) {
    turn.actionUsed = false;
    turn.actionSurgeUsed = true;
  }
  if (option.effect?.turnFlag) turn[option.effect.turnFlag] = true;
  if (option.spell && Number(option.spell?.level ?? 0) > 0) {
    turn.leveledSpellCast = true;
    turn.leveledSpellName = option.name;
  }

  return addLogEntry({
    ...state,
    current: applyOptionCurrentEffects(option, state.current),
    turn,
    resourcesUsed: spendResource(state.resourcesUsed, option.cost?.resource)
  }, `${option.name} used.`);
}

function applyOptionCurrentEffects(option, current) {
  let next = option.effect?.wildShape
    ? { ...current, currentForm: "Wild Shape" }
    : option.spell?.concentration
      ? { ...current, concentration: option.name, concentrationSource: option.source === "spell" ? "spell" : "feature" }
      : current;

  if (option.effect?.activeEffect) {
    next = {
      ...next,
      activeEffects: [...new Set([...(next.activeEffects ?? []), option.effect.activeEffect])]
    };
  }
  if (option.effect?.clearEffect) {
    next = {
      ...next,
      activeEffects: (next.activeEffects ?? []).filter((entry) => entry !== option.effect.clearEffect)
    };
  }
  return next;
}

function mergeState(state, patch) {
  return {
    ...state,
    ...patch,
    turn: { ...state.turn, ...(patch.turn ?? {}) },
    current: { ...state.current, ...(patch.current ?? {}) },
    resourcesUsed: { ...state.resourcesUsed, ...(patch.resourcesUsed ?? {}) },
    lastRoll: patch.lastRoll ?? state.lastRoll
  };
}

function spendResource(resourcesUsed, resource) {
  if (!resource) return resourcesUsed;
  if (resource.type === "classResource") {
    return {
      ...resourcesUsed,
      classResources: {
        ...(resourcesUsed?.classResources ?? {}),
        [resource.id]: Number(resourcesUsed?.classResources?.[resource.id] ?? 0) + Number(resource.amount ?? 1)
      }
    };
  }
  if (resource.type !== "spellSlot") return resourcesUsed;
  const level = String(resource.level);
  return {
    ...resourcesUsed,
    spellSlots: {
      ...(resourcesUsed?.spellSlots ?? {}),
      [level]: Number(resourcesUsed?.spellSlots?.[level] ?? 0) + 1
    }
  };
}

function spellSlotMax(value) {
  const max = value && typeof value === "object" ? Number(value.available ?? value.max ?? value.value ?? 0) : Number(value ?? 0);
  return Number.isFinite(max) ? max : 0;
}

function findClassResource(character, resourceId) {
  return [
    ...(character.resources?.classResources ?? []),
    ...(character.resources?.limitedUses ?? [])
  ].find((resource) => resource.id === resourceId);
}

function clamp(value, min, max) {
  const numeric = Number.isFinite(value) ? value : min;
  const upper = Number.isFinite(max) ? max : min;
  return Math.min(Math.max(numeric, min), upper);
}

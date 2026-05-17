import { addLogEntry, createCombatState, resetTurn } from "../models/combatStateModel.js";

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
    combatStates[activeCharacterId] = addLogEntry({ ...state, lastRoll: result }, message);
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
      turn: resetTurn({ reactionUsed: state.turn.reactionUsed })
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

    const turn = { ...state.turn };
    if (option.cost?.action) turn.actionUsed = true;
    if (option.cost?.bonus) turn.bonusActionUsed = true;
    if (option.cost?.reaction) turn.reactionUsed = true;
    if (option.cost?.object) turn.objectInteractionUsed = true;

    const resourcesUsed = spendResource(state.resourcesUsed, option.cost?.resource);
    combatStates[activeCharacterId] = addLogEntry({
      ...state,
      turn,
      resourcesUsed
    }, `${option.name} used.`);
    persistCombatStates();
    emitChange();
  }

  function useMovement(amount) {
    const state = getCombatState();
    const movementUsed = Math.max(0, (state?.turn.movementUsed ?? 0) + Number(amount || 0));
    updateTurn({ movementUsed }, `Movement set to ${movementUsed} ft.`);
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
    useMovement,
    setSpellSlotUsed,
    adjustSpellSlotUsed,
    resetSpellSlots,
    logMessage,
    logRoll,
    getSnapshot
  };
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

function clamp(value, min, max) {
  const numeric = Number.isFinite(value) ? value : min;
  const upper = Number.isFinite(max) ? max : min;
  return Math.min(Math.max(numeric, min), upper);
}

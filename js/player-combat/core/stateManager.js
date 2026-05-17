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

  function useMovement(amount) {
    const state = getCombatState();
    const movementUsed = Math.max(0, (state?.turn.movementUsed ?? 0) + Number(amount || 0));
    updateTurn({ movementUsed }, `Movement set to ${movementUsed} ft.`);
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
    useMovement,
    getSnapshot
  };
}

function mergeState(state, patch) {
  return {
    ...state,
    ...patch,
    turn: { ...state.turn, ...(patch.turn ?? {}) },
    current: { ...state.current, ...(patch.current ?? {}) },
    resourcesUsed: { ...state.resourcesUsed, ...(patch.resourcesUsed ?? {}) }
  };
}

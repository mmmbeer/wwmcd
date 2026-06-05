import { recordPerformanceMetric } from "./performanceMetrics.js";

const KEYS = {
  characters: "pca.characters",
  activeCharacterId: "pca.activeCharacterId",
  combatState: "pca.combatState",
  combatStateIndex: "pca.combatState.index",
  combatStatePrefix: "pca.combatState.",
  settings: "pca.settings",
  importHistory: "pca.importHistory"
};

export function createStorage() {
  const available = isLocalStorageAvailable();

  function read(key, fallback) {
    if (!available) return fallback;
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    if (!available) return false;
    try {
      return writeSerialized(key, JSON.stringify(value));
    } catch {
      return false;
    }
  }

  function writeSerialized(key, value) {
    if (!available) return false;
    try {
      if (localStorage.getItem(key) === value) return true;
      localStorage.setItem(key, value);
      recordPerformanceMetric("storage.write", { key, bytes: value.length });
      return true;
    } catch {
      return false;
    }
  }

  function remove(key) {
    if (!available) return false;
    try {
      localStorage.removeItem(key);
      recordPerformanceMetric("storage.remove", { key });
      return true;
    } catch {
      return false;
    }
  }

  function getCombatStates() {
    const ids = read(KEYS.combatStateIndex, []);
    if (Array.isArray(ids) && ids.length) return readIndexedCombatStates(ids);

    const legacyStates = read(KEYS.combatState, {});
    if (legacyStates && typeof legacyStates === "object" && Object.keys(legacyStates).length) {
      saveCombatStates(legacyStates);
      remove(KEYS.combatState);
    }
    return legacyStates;
  }

  function readIndexedCombatStates(ids) {
    const states = {};

    ids.forEach((id) => {
      const state = read(combatStateKey(id), null);
      if (state) states[id] = state;
    });
    return states;
  }

  function saveCombatState(characterId, state) {
    if (!characterId || !state) return false;
    const ids = read(KEYS.combatStateIndex, []);
    const nextIds = Array.isArray(ids) && ids.includes(characterId) ? ids : [...(Array.isArray(ids) ? ids : []), characterId];
    const savedState = writeSerialized(combatStateKey(characterId), JSON.stringify(state));
    const savedIndex = nextIds === ids || write(KEYS.combatStateIndex, nextIds);
    return savedState && savedIndex;
  }

  function saveCombatStates(states) {
    if (!states || typeof states !== "object") return false;
    const entries = Object.entries(states);
    const savedStates = entries.every(([characterId, state]) => writeSerialized(combatStateKey(characterId), JSON.stringify(state)));
    const savedIndex = write(KEYS.combatStateIndex, entries.map(([characterId]) => characterId));
    return savedStates && savedIndex;
  }

  return {
    available,
    keys: KEYS,
    getCharacters: () => read(KEYS.characters, []),
    saveCharacters: (characters) => write(KEYS.characters, characters),
    getActiveCharacterId: () => read(KEYS.activeCharacterId, null),
    saveActiveCharacterId: (characterId) => write(KEYS.activeCharacterId, characterId),
    getCombatStates,
    saveCombatState,
    saveCombatStates,
    getSettings: () => read(KEYS.settings, {}),
    saveSettings: (settings) => write(KEYS.settings, settings),
    getImportHistory: () => read(KEYS.importHistory, []),
    saveImportHistory: (history) => write(KEYS.importHistory, history)
  };
}

function combatStateKey(characterId) {
  return `${KEYS.combatStatePrefix}${characterId}`;
}

function isLocalStorageAvailable() {
  try {
    const key = "__pca_storage_test__";
    localStorage.setItem(key, "1");
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

const KEYS = {
  characters: "pca.characters",
  activeCharacterId: "pca.activeCharacterId",
  combatState: "pca.combatState",
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
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  return {
    available,
    keys: KEYS,
    getCharacters: () => read(KEYS.characters, []),
    saveCharacters: (characters) => write(KEYS.characters, characters),
    getActiveCharacterId: () => read(KEYS.activeCharacterId, null),
    saveActiveCharacterId: (characterId) => write(KEYS.activeCharacterId, characterId),
    getCombatStates: () => read(KEYS.combatState, {}),
    saveCombatStates: (states) => write(KEYS.combatState, states),
    getSettings: () => read(KEYS.settings, {}),
    saveSettings: (settings) => write(KEYS.settings, settings),
    getImportHistory: () => read(KEYS.importHistory, []),
    saveImportHistory: (history) => write(KEYS.importHistory, history)
  };
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

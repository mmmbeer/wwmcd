import assert from "node:assert/strict";
import test from "node:test";

import { createStorage } from "../js/player-combat/core/storage.js";

test("combat states migrate from legacy bulk storage to split per-character keys", () => {
  withMockLocalStorage(() => {
    localStorage.setItem("pca.combatState", JSON.stringify({
      alpha: { characterId: "alpha", round: 1 },
      beta: { characterId: "beta", round: 2 }
    }));

    const storage = createStorage();
    const states = storage.getCombatStates();

    assert.equal(states.alpha.round, 1);
    assert.equal(states.beta.round, 2);
    assert.equal(localStorage.getItem("pca.combatState"), null);
    assert.deepEqual(JSON.parse(localStorage.getItem("pca.combatState.index")), ["alpha", "beta"]);
    assert.equal(JSON.parse(localStorage.getItem("pca.combatState.alpha")).round, 1);
  });
});

test("saving one combat state updates only that character blob and index", () => {
  withMockLocalStorage(() => {
    const storage = createStorage();

    storage.saveCombatState("alpha", { characterId: "alpha", round: 3 });
    storage.saveCombatState("alpha", { characterId: "alpha", round: 4 });

    assert.deepEqual(JSON.parse(localStorage.getItem("pca.combatState.index")), ["alpha"]);
    assert.equal(JSON.parse(localStorage.getItem("pca.combatState.alpha")).round, 4);
    assert.equal(localStorage.getItem("pca.combatState"), null);
  });
});

function withMockLocalStorage(run) {
  const original = globalThis.localStorage;
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => store.has(key) ? store.get(key) : null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key)
  };
  try {
    run();
  } finally {
    globalThis.localStorage = original;
  }
}

import assert from "node:assert/strict";
import test from "node:test";

import { showEndTurnModal } from "../js/player-combat/app.js";

test("end turn modal return path does not reset the active turn", () => {
  const calls = [];
  const modal = captureEndTurnModal(activeTurnState(), calls);

  showEndTurnModal(modal);

  assert.deepEqual(calls, []);
  assert.ok(modal.actions.some((action) => action.label === "Return"));
});

test("start new turn commits end turn before starting the next turn", async () => {
  const calls = [];
  const modal = captureEndTurnModal(activeTurnState(), calls);

  showEndTurnModal(modal);
  await modal.actions.find((action) => action.label === "Start New Turn").onClick();

  assert.deepEqual(calls, ["endTurn", "startTurn", "close"]);
});

test("start new turn does not end an already completed turn twice", async () => {
  const calls = [];
  const state = activeTurnState();
  state.combatState.turnActive = false;
  const modal = captureEndTurnModal(state, calls);

  showEndTurnModal(modal);
  await modal.actions.find((action) => action.label === "Start New Turn").onClick();

  assert.deepEqual(calls, ["startTurn", "close"]);
});

function captureEndTurnModal(snapshot, calls) {
  let capturedActions = [];
  return {
    get actions() {
      return capturedActions;
    },
    modalApi: {
      showModal({ actions }) {
        capturedActions = actions;
      },
      close() {
        calls.push("close");
      }
    },
    stateManager: {
      getSnapshot: () => snapshot,
      endTurn: () => {
        calls.push("endTurn");
        snapshot.combatState.turnActive = false;
      },
      startTurn: () => {
        calls.push("startTurn");
        snapshot.combatState.turnActive = true;
      }
    },
    busyApi: {
      async run(label, task) {
        return task();
      }
    }
  };
}

function activeTurnState() {
  return {
    activeCharacter: {
      combat: { speed: { walk: 30 } },
      features: { class: [], race: [], feats: [], other: [] }
    },
    referenceData: null,
    combatState: {
      turnActive: true,
      turn: {
        actionUsed: true,
        bonusActionUsed: false,
        reactionUsed: false,
        movementUsed: 10
      }
    }
  };
}

import { formatFeet } from "./renderUtils.js";
import { getAttackCount } from "../rules/attackCountRules.js";

export function renderTurnEconomyPanel(root, snapshot, stateManager) {
  const character = snapshot.activeCharacter;
  const state = snapshot.combatState;

  if (!character || !state) {
    root.innerHTML = "";
    return;
  }

  const speed = Number(character.combat.speed.walk ?? 0);
  const movementUsed = Number(state.turn.movementUsed ?? 0);
  const movement = `${formatFeet(movementUsed)} / ${formatFeet(speed)}`;
  const attacks = getAttackCount(character);
  root.innerHTML = `
    <nav class="turn-progress" aria-label="Turn progress">
      ${segment("actions", "Actions", state.turn.actionUsed, attacks > 1 ? `${attacks} attacks` : "1 action")}
      ${segment("bonus", "Bonus Action", state.turn.bonusActionUsed, "1 bonus")}
      ${segment("reaction", "Reaction", state.turn.reactionUsed, "1 reaction")}
      ${segment("free", "Free Action", state.turn.objectInteractionUsed, "object")}
      <div class="turn-movement ${movementUsed >= speed ? "is-spent" : ""}">
        <button class="turn-segment" type="button" data-group="movement">
          <span>Movement</span>
          <strong>${movement}</strong>
        </button>
        <button class="turn-move-add" type="button" data-move="5" aria-label="Add 5 feet of movement">+</button>
      </div>
      <button class="turn-done" type="button" data-turn="end">Done</button>
    </nav>
  `;

  root.querySelector("[data-turn='end']").addEventListener("click", () => stateManager.endTurn());
  root.querySelector("[data-move='5']").addEventListener("click", () => stateManager.useMovement(5));
  root.querySelectorAll("[data-group]").forEach((button) => {
    button.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("combat:select-option-group", { detail: { group: button.dataset.group } }));
    });
  });
}

function segment(group, label, spent, detail) {
  return `
    <button class="turn-segment ${spent ? "is-spent" : ""}" type="button" data-group="${group}">
      <span>${label}</span>
      <strong>${spent ? "Used" : detail}</strong>
    </button>
  `;
}

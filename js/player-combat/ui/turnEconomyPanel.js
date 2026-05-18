import { formatFeet } from "./renderUtils.js";
import { getAttackCount } from "../rules/attackCountRules.js";

export function renderTurnEconomyPanel(root, snapshot, stateManager) {
  const character = snapshot.activeCharacter;
  const state = snapshot.combatState;

  if (!character || !state) {
    document.body.classList.remove("has-turn-progress");
    root.innerHTML = "";
    return;
  }

  document.body.classList.add("has-turn-progress");
  const speed = Number(character.combat.speed.walk ?? 0);
  const movementUsed = Number(state.turn.movementUsed ?? 0);
  const movement = `${formatFeet(movementUsed)}/${formatFeet(speed)}`;
  const actionsAvailable = getAttackCount(character);
  root.innerHTML = `
    <nav class="turn-progress" aria-label="Turn progress">
      ${segment("actions", "Action", state.turn.actionUsed, actionsAvailable, state.turn.actionUsed ? actionsAvailable : 0)}
      ${segment("bonus", "Bonus Action", state.turn.bonusActionUsed)}
      ${segment("reaction", "Reaction", state.turn.reactionUsed)}
      ${segment("free", "Free", state.turn.objectInteractionUsed)}
      <div class="turn-movement ${movementUsed >= speed ? "is-spent" : ""}">
        <button class="turn-segment" type="button" data-group="movement">
          <span>Movement: ${movement}</span>
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

function segment(group, label, spent, total = 1, used = spent ? 1 : 0) {
  const partial = total > 1 && used > 0 && used < total;
  const progress = partial ? ` (${used}/${total})` : "";
  return `
    <button class="turn-segment ${spent ? "is-spent" : ""} ${partial ? "is-partial" : ""}" type="button" data-group="${group}">
      <span>${label}${progress}</span>
    </button>
  `;
}

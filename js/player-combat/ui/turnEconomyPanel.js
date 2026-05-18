import { formatFeet } from "./renderUtils.js";
import { getAttackCount } from "../rules/attackCountRules.js";

export function renderTurnEconomyPanel(root, snapshot, { stateManager, modalApi }) {
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
      <button class="turn-log" type="button" data-roll-log>Dice Log</button>
    </nav>
  `;

  root.querySelector("[data-turn='end']").addEventListener("click", () => stateManager.endTurn());
  root.querySelector("[data-roll-log]").addEventListener("click", () => openRollLogModal(state, modalApi));
  root.querySelector("[data-move='5']").addEventListener("click", () => stateManager.useMovement(5));
  root.querySelectorAll("[data-group]").forEach((button) => {
    button.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("combat:select-option-group", { detail: { group: button.dataset.group } }));
    });
  });
}

function openRollLogModal(state, modalApi) {
  const rolls = (state.log ?? []).filter((entry) => entry.type === "roll" || looksLikeRoll(entry.message));
  modalApi.showModal({
    title: "Dice Log",
    body: rolls.length ? `
      <ol class="dice-log-list">
        ${rolls.map((entry) => `
          <li class="dice-log-entry">
            <span>${escapeHtml(entry.message)}</span>
            <small>R${escapeHtml(entry.round)} ${escapeHtml(formatTime(entry.at))}</small>
          </li>
        `).join("")}
      </ol>
    ` : `<p class="inline-message">No dice rolls yet.</p>`,
    actions: [{ label: "Close", variant: "secondary" }]
  });
}

function looksLikeRoll(message) {
  return /:\s*-?\d+\s*\([^)]*(?:d\d+|modifier)/i.test(String(message ?? ""));
}

function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
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

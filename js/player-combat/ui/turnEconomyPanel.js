import { formatFeet } from "./renderUtils.js";
import { getAttackCount } from "../rules/attackCountRules.js";
import { getPlannedTurn, selectPlannedOption } from "./plannedTurnState.js";

export function renderTurnEconomyPanel(root, snapshot, { modalApi }) {
  const character = snapshot.activeCharacter;
  const state = snapshot.combatState;

  if (!character || !state) {
    root.innerHTML = "";
    return;
  }

  const speed = Number(character.combat.speed.walk ?? 0);
  const movementUsed = Number(state.turn.movementUsed ?? 0);
  const plan = getPlannedTurn();
  const plannedMovement = Number(plan.movementUsed ?? 0);
  const movement = `${formatFeet(Math.min(movementUsed + plannedMovement, speed))}/${formatFeet(speed)}`;
  const actionsAvailable = getAttackCount(character, snapshot.referenceData);
  root.innerHTML = `
    <nav class="turn-progress" aria-label="Action economy">
      ${segment("actions", "Action", state.turn.actionUsed, Boolean(plan.action), actionsAvailable)}
      ${segment("bonus", "Bonus", state.turn.bonusActionUsed, Boolean(plan.bonusAction))}
      ${segment("reaction", "React", state.turn.reactionUsed, Boolean(plan.reaction))}
      ${segment("free", "Free", false, Boolean(plan.freeActions.length), 1, "Unlimited")}
      <div class="turn-movement ${movementUsed >= speed ? "is-spent" : ""} ${plannedMovement ? "is-planned" : ""}">
        <button class="turn-segment" type="button" data-group="movement">
          <span class="turn-icon" aria-hidden="true">↗</span>
          <span>Move</span>
          <strong>${movement}</strong>
        </button>
        <button class="turn-move-add" type="button" data-move="5" aria-label="Add 5 feet of movement">+</button>
      </div>
      <button class="turn-log" type="button" data-roll-log>Log</button>
    </nav>
  `;

  root.querySelector("[data-roll-log]").addEventListener("click", () => openRollLogModal(state, modalApi));
  root.querySelector("[data-move='5']").addEventListener("click", () => {
    selectPlannedOption({
      id: "movement_walk",
      name: "Move",
      available: movementUsed + plannedMovement < speed,
      cost: { movement: true },
      movement: { remaining: speed - movementUsed, speed, step: 5 }
    });
  });
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

function segment(group, label, spent, planned = false, total = 1, overrideStatus = null) {
  const status = overrideStatus ?? (spent ? "Spent" : planned ? "Planned" : "Ready");
  return `
    <button class="turn-segment ${spent ? "is-spent" : ""} ${planned ? "is-planned" : ""}" type="button" data-group="${group}">
      <span class="turn-icon" aria-hidden="true">${iconFor(group)}</span>
      <span>${label}</span>
      <strong>${escapeHtml(status)}${total > 1 && !spent && !planned ? ` x${escapeHtml(total)}` : ""}</strong>
    </button>
  `;
}

function iconFor(group) {
  return {
    actions: "⚔",
    bonus: "✦",
    reaction: "↯",
    free: "•"
  }[group] ?? "◆";
}

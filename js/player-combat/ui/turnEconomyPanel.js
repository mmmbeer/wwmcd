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
  const actionStatus = plannedActionStatus(plan.action);
  root.innerHTML = `
    <nav class="turn-progress" aria-label="Action economy">
      ${segment("actions", "Action", state.turn.actionUsed, actionProgress(plan, actionsAvailable), actionsAvailable, actionStatus)}
      ${segment("bonus", "Bonus", state.turn.bonusActionUsed, plan.bonusAction ? 0.55 : 0)}
      ${segment("reaction", "Reaction", state.turn.reactionUsed, plan.reaction ? 0.55 : 0)}
      ${segment("free", "Free", false, plan.freeActions.length ? 1 : 0, 1, "Unlimited")}
      <div class="turn-movement ${movementUsed >= speed ? "is-spent" : ""} ${plannedMovement ? "is-planned" : ""}">
        <button class="turn-segment" type="button" data-group="movement" style="--turn-progress-fill: ${escapeHtml(movementProgress(speed, movementUsed, plannedMovement))}">
          ${progressCircle("move")}
          <span class="turn-label">Move</span>
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

function segment(group, label, spent, progress = 0, total = 1, overrideStatus = null) {
  const planned = progress > 0 && !spent;
  const fill = spent ? 1 : progress;
  const status = overrideStatus ?? (spent ? "Spent" : planned ? "Planned" : "Ready");
  return `
    <button class="turn-segment ${spent ? "is-spent" : ""} ${planned ? "is-planned" : ""}" type="button" data-group="${group}" style="--turn-progress-fill: ${escapeHtml(fill)}">
      ${progressCircle(group)}
      <span class="turn-label">${label}</span>
      <strong>${escapeHtml(status)}${total > 1 && !spent && !planned ? ` x${escapeHtml(total)}` : ""}</strong>
    </button>
  `;
}

function progressCircle(group) {
  return `
    <span class="turn-progress-ring" aria-hidden="true">
      <span class="turn-icon">${iconFor(group)}</span>
    </span>
  `;
}

function actionProgress(plan, fallbackAttackCount) {
  if (!plan.action) return 0;
  if (!isAttackAction(plan.action)) return 0.55;
  const capacity = attackCapacity(plan.action) || fallbackAttackCount;
  const planned = Math.max(1, plan.actionAttacks?.length ?? 0);
  return Math.max(0.18, Math.min(1, planned / Math.max(1, capacity)));
}

function movementProgress(speed, used, planned) {
  if (speed <= 0) return 0;
  return Math.max(0, Math.min(1, (used + planned) / speed));
}

function plannedActionStatus(option) {
  const plan = getPlannedTurn();
  if (plan.actionAttacks?.length) {
    const capacity = attackCapacity(option);
    return `Planned ${plan.actionAttacks.length}/${capacity}`;
  }
  if (!option || !isAttackAction(option)) return null;
  const attackCount = attackCapacity(option);
  return attackCount > 1 ? `Planned x${attackCount}` : null;
}

function isAttackAction(option) {
  return Boolean(option?.cost?.action)
    && (option.tags?.includes("attack") || option.rolls?.some((roll) => roll.type === "attack" || roll.id === "attack"));
}

function attackCapacity(option) {
  return Math.max(1, Number(option?.attack?.count ?? 1));
}

function iconFor(group) {
  const icons = {
    actions: "A",
    bonus: "B",
    reaction: "R",
    free: "F",
    move: "M"
  };
  return icons[group] ?? "A";
}

import { formatFeet } from "./renderUtils.js";
import { getAttackCount } from "../rules/attackCountRules.js";
import { getPlannedTurn } from "./plannedTurnState.js";

export function renderTurnEconomyPanel(root, snapshot, { stateManager }) {
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
  const objectInteractionUsed = Boolean(state.turn.objectInteractionUsed);
  root.innerHTML = `
    <nav class="turn-progress" aria-label="Action economy">
      ${segment("actions", "Action", state.turn.actionUsed, actionProgress(plan, actionsAvailable), actionsAvailable, actionStatus)}
      ${segment("bonus", "Bonus", state.turn.bonusActionUsed, plan.bonusAction ? 0.55 : 0)}
      ${segment("reaction", "Reaction", state.turn.reactionUsed, plan.reaction ? 0.55 : 0)}
      ${segment("free", "Object", objectInteractionUsed, objectInteractionUsed ? 1 : objectInteractionPlanned(plan) ? 0.55 : 0, 1, objectInteractionUsed ? null : objectInteractionPlanned(plan) ? "Planned" : "1/round")}
      <div class="turn-movement ${movementUsed >= speed ? "is-spent" : ""} ${plannedMovement ? "is-planned" : ""}">
        <button class="turn-segment" type="button" data-move="5" style="--turn-progress-fill: ${escapeHtml(movementProgress(speed, movementUsed, plannedMovement))}" aria-label="Use 5 feet of movement">
          ${progressCircle("move")}
          <span class="turn-label">Move</span>
          <strong>${movement}</strong>
        </button>
      </div>
      <button class="turn-end" type="button" data-end-turn>End Turn</button>
    </nav>
  `;

  root.querySelector("[data-move='5']").addEventListener("click", () => {
    stateManager.useMovement(5);
  });
  root.querySelector("[data-end-turn]").addEventListener("click", () => {
    window.dispatchEvent(new CustomEvent("combat:end-turn-requested"));
  });
  root.querySelectorAll("[data-group]").forEach((button) => {
    button.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("combat:select-option-group", { detail: { group: button.dataset.group } }));
    });
  });
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

function objectInteractionPlanned(plan) {
  return plan.freeActions?.some((option) => option.cost?.object);
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

import { rollDamage, rollDice } from "../core/diceRoller.js";
import { getCombatOptions } from "../rules/combatOptionsService.js";
import { formatRollSummary, renderDiceResult } from "./diceResult.js";
import { escapeHtml } from "./renderUtils.js";

const GROUPS = [
  ["recommended", "Recommended"],
  ["actions", "Actions"],
  ["bonus", "Bonus"],
  ["movement", "Movement"],
  ["spells", "Spells"],
  ["resources", "Resources"],
  ["log", "Log"]
];

export function renderActionTabs(root, snapshot, { stateManager }) {
  const character = snapshot.activeCharacter;
  const combatState = snapshot.combatState;

  if (!character || !combatState) {
    root.innerHTML = `<p class="inline-message">Combat options appear after character import.</p>`;
    return;
  }

  const groups = getCombatOptions({ character, combatState, referenceData: snapshot.referenceData });
  root.innerHTML = `
    ${combatState.lastRoll ? `<div class="latest-roll">${renderDiceResult(combatState.lastRoll)}</div>` : ""}
    <div class="option-tabs">
      ${GROUPS.map(([key, label]) => renderGroup(key, label, groups[key] ?? [], combatState)).join("")}
    </div>
  `;

  root.querySelectorAll("[data-roll-option]").forEach((button) => {
    button.addEventListener("click", () => handleRoll(button, groups, stateManager));
  });

  root.querySelectorAll("[data-use-option]").forEach((button) => {
    button.addEventListener("click", () => {
      const option = findOption(groups, button.dataset.useOption);
      if (option) stateManager.useCombatOption(option);
    });
  });
}

function renderGroup(key, label, options, combatState) {
  if (key === "log") return renderLogGroup(label, combatState);
  return `
    <section class="option-group" aria-labelledby="option-${key}">
      <h3 id="option-${key}">${escapeHtml(label)}</h3>
      <div class="option-card-grid">
        ${options.length ? options.map(renderOptionCard).join("") : `<p class="inline-message">No ${escapeHtml(label.toLowerCase())} options yet.</p>`}
      </div>
    </section>
  `;
}

function renderOptionCard(option) {
  const unavailable = option.available === false;
  return `
    <article class="option-card ${unavailable ? "is-unavailable" : ""}">
      <div class="option-card-header">
        <strong>${escapeHtml(option.name)}</strong>
        <span class="badge">${escapeHtml(costLabel(option))}</span>
      </div>
      <p>${escapeHtml(option.description || "")}</p>
      ${renderMeta(option)}
      ${unavailable ? renderReasons(option.unavailableReasons) : ""}
      <div class="button-row">
        ${(option.rolls ?? []).map((roll) => `
          <button class="btn btn-secondary" type="button" data-roll-option="${escapeHtml(option.id)}" data-roll-id="${escapeHtml(roll.id)}" ${unavailable ? "disabled" : ""}>
            ${escapeHtml(roll.label)}
          </button>
        `).join("")}
        ${hasUseCost(option) ? `
          <button class="btn btn-primary" type="button" data-use-option="${escapeHtml(option.id)}" ${unavailable ? "disabled" : ""}>
            ${escapeHtml(useLabel(option))}
          </button>
        ` : ""}
      </div>
    </article>
  `;
}

function renderMeta(option) {
  if (!option.meta?.length) return "";
  return `<ul class="option-meta">${option.meta.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderReasons(reasons = []) {
  return `<p class="inline-message warning">${escapeHtml(reasons.join(" "))}</p>`;
}

function renderLogGroup(label, combatState) {
  const log = combatState.log ?? [];
  return `
    <section class="option-group" aria-labelledby="option-log">
      <h3 id="option-log">${escapeHtml(label)}</h3>
      ${log.length ? `
        <ul class="log-list">
          ${log.slice(0, 8).map((entry) => `
            <li class="list-item">
              <span>${escapeHtml(entry.message)}</span>
              <small>R${escapeHtml(entry.round)}</small>
            </li>
          `).join("")}
        </ul>
      ` : `<p class="inline-message">No combat log yet.</p>`}
    </section>
  `;
}

function handleRoll(button, groups, stateManager) {
  const option = findOption(groups, button.dataset.rollOption);
  const roll = option?.rolls?.find((entry) => entry.id === button.dataset.rollId);
  if (!option || !roll) return;

  const result = roll.type === "damage"
    ? rollDamage({ formula: roll.formula, label: `${option.name} ${roll.label}` })
    : rollDice(roll.formula, { label: `${option.name} ${roll.label}`, type: roll.type });

  stateManager.logRoll(result, formatRollSummary(result));
}

function findOption(groups, id) {
  return Object.values(groups).flat().find((option) => option.id === id);
}

function costLabel(option) {
  if (option.cost?.bonus) return "Bonus";
  if (option.cost?.reaction) return "Reaction";
  if (option.cost?.movement) return "Movement";
  if (option.cost?.action) return "Action";
  return option.resource ?? "Option";
}

function useLabel(option) {
  return option.source === "spell" ? "Cast" : option.cost?.movement ? "Use Move" : "Use";
}

function hasUseCost(option) {
  return option.cost?.action || option.cost?.bonus || option.cost?.reaction || option.cost?.object || option.cost?.resource;
}

import { rollDamage, rollDice } from "../core/diceRoller.js";
import { getCombatOptions } from "../rules/combatOptionsService.js";
import { formatRollSummary } from "./diceResult.js";
import { showConfirmModal } from "./modal.js";
import { escapeHtml } from "./renderUtils.js";
import { renderSpellDetailCard } from "./spellDetailCard.js";

const GROUPS = [
  ["recommended", "Recommended"],
  ["actions", "Actions"],
  ["attacks", "Attacks"],
  ["bonus", "Bonus"],
  ["reaction", "Reaction"],
  ["movement", "Movement"],
  ["free", "Free Action"],
  ["spells", "Spells"],
  ["resources", "Resources"],
  ["log", "Log"]
];
const GROUP_LABELS = Object.fromEntries(GROUPS);
let selectedGroup = "recommended";
let selectedSpellLevel = null;
let selectedSpellCost = null;
let lastRender = null;

export function renderActionTabs(root, snapshot, { stateManager, modalApi, showToast }) {
  lastRender = () => renderActionTabs(root, snapshot, { stateManager, modalApi, showToast });
  bindGroupSelection();
  const character = snapshot.activeCharacter;
  const combatState = snapshot.combatState;

  if (!character || !combatState) {
    root.innerHTML = `<p class="inline-message">Combat options appear after character import.</p>`;
    return;
  }

  const groups = getCombatOptions({ character, combatState, referenceData: snapshot.referenceData });
  const visibleGroup = groups[selectedGroup] ? selectedGroup : "recommended";
  const visibleOptions = filterOptions(visibleGroup, groups[visibleGroup] ?? []);
  root.innerHTML = `
    <div class="option-tabs">
      <div class="button-row">
        ${GROUPS.map(([key, label]) => `<button class="btn ${key === visibleGroup ? "btn-primary" : "btn-secondary"}" type="button" data-tab-group="${escapeHtml(key)}">${escapeHtml(label)}</button>`).join("")}
      </div>
      ${renderGroup(visibleGroup, groupLabel(visibleGroup), visibleOptions, combatState)}
    </div>
  `;

  root.querySelectorAll("[data-tab-group]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedGroup = button.dataset.tabGroup;
      selectedSpellLevel = null;
      selectedSpellCost = null;
      renderActionTabs(root, snapshot, { stateManager, modalApi, showToast });
    });
  });

  root.querySelectorAll("[data-select-group]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      selectedGroup = button.dataset.selectGroup;
      selectedSpellLevel = button.dataset.spellLevel ? Number(button.dataset.spellLevel) : null;
      selectedSpellCost = button.dataset.spellCost ?? null;
      renderActionTabs(root, snapshot, { stateManager, modalApi, showToast });
    });
  });

  root.querySelectorAll("[data-roll-option]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      handleRoll(button, groups, stateManager, showToast);
    });
  });

  root.querySelectorAll("[data-use-option]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const option = findOption(groups, button.dataset.useOption);
      if (option) useOption(option, combatState, stateManager, modalApi);
    });
  });

  root.querySelectorAll("[data-use-movement]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      stateManager.useMovement(Number(button.dataset.useMovement || 5));
    });
  });

  root.querySelectorAll("[data-expand-target]").forEach((row) => {
    row.addEventListener("click", () => toggleExpandedRow(root, row));
  });

  bindSpellDetailCards(root);
}

function bindGroupSelection() {
  if (bindGroupSelection.bound) return;
  bindGroupSelection.bound = true;
  window.addEventListener("combat:select-option-group", (event) => {
    selectedGroup = event.detail?.group ?? selectedGroup;
    selectedSpellLevel = event.detail?.spellLevel ?? null;
    selectedSpellCost = event.detail?.spellCost ?? null;
    lastRender?.();
    document.querySelector("#actions-title")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function filterOptions(group, options) {
  if (group !== "spells") return options;
  return options.filter((option) => {
    const levelMatches = selectedSpellLevel === null || option.spell?.level === selectedSpellLevel;
    const costMatches = !selectedSpellCost || option.cost?.[selectedSpellCost];
    return levelMatches && costMatches;
  });
}

function groupLabel(group) {
  if (group !== "spells") return GROUP_LABELS[group];
  if (selectedSpellLevel !== null) return `Spells: Level ${selectedSpellLevel}`;
  if (selectedSpellCost) return `Spells: ${costFilterLabel(selectedSpellCost)}`;
  return GROUP_LABELS[group];
}

function costFilterLabel(cost) {
  return {
    action: "Action",
    bonus: "Bonus Action",
    reaction: "Reaction"
  }[cost] ?? cost;
}

function renderGroup(key, label, options, combatState) {
  if (key === "log") return renderLogGroup(label, combatState);
  return `
    <section class="option-group" aria-labelledby="option-${key}">
      <h3 id="option-${key}">${escapeHtml(label)}</h3>
      ${options.length ? renderOptionTable(key, options) : `<p class="inline-message">No ${escapeHtml(label.toLowerCase())} options yet.</p>`}
    </section>
  `;
}

function renderOptionTable(group, options) {
  if (group === "attacks") return renderAttackTable(options);
  if (group === "spells") return renderSpellTable(options);
  return `
    <div class="option-table-wrap">
      <table class="option-table">
        <thead>
          <tr>
            <th scope="col">Type</th>
            <th scope="col">Action Name</th>
            <th scope="col">Description</th>
            <th scope="col">Action Buttons</th>
          </tr>
        </thead>
        <tbody>
          ${options.map(renderOptionRow).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderOptionRow(option) {
  const unavailable = option.available === false;
  return `
    <tr class="${unavailable ? "is-unavailable" : ""}">
      <td>${renderTypeBadge(option)}</td>
      <th scope="row">${escapeHtml(option.name)}</th>
      <td>
        <p>${escapeHtml(option.description || "")}</p>
        ${renderMeta(option)}
        ${renderWarnings(option.warnings)}
        ${unavailable ? renderReasons(option.unavailableReasons) : ""}
      </td>
      <td>${renderOptionButtons(option, unavailable)}</td>
    </tr>
  `;
}

function renderOptionButtons(option, unavailable) {
  if (option.cost?.movement) {
    return `
      <div class="button-row option-button-row">
        <button class="btn btn-primary" type="button" data-use-movement="${escapeHtml(option.movement?.step ?? 5)}" ${unavailable ? "disabled" : ""}>
          +${escapeHtml(option.movement?.step ?? 5)} ft
        </button>
      </div>
    `;
  }

  return `
    <div class="button-row option-button-row">
      ${(option.rolls ?? []).map((roll) => `
        <button class="btn btn-secondary" type="button" data-roll-option="${escapeHtml(option.id)}" data-roll-id="${escapeHtml(roll.id)}" ${unavailable ? "disabled" : ""}>
          ${escapeHtml(roll.label)}
        </button>
      `).join("")}
      ${option.navigateTo ? `
        <button class="btn btn-primary" type="button" data-select-group="${escapeHtml(option.navigateTo.group)}" ${option.navigateTo.spellCost ? `data-spell-cost="${escapeHtml(option.navigateTo.spellCost)}"` : ""} ${unavailable ? "disabled" : ""}>
          Use
        </button>
      ` : ""}
      ${!option.navigateTo && hasUseCost(option) ? `
        <button class="btn btn-primary" type="button" data-use-option="${escapeHtml(option.id)}" ${unavailable ? "disabled" : ""}>
          ${escapeHtml(useLabel(option))}
        </button>
      ` : ""}
    </div>
  `;
}

function renderAttackTable(options) {
  return `
    <div class="option-table-wrap">
      <table class="option-table attack-table">
        <thead>
          <tr>
            <th scope="col">Type</th>
            <th scope="col">Attack</th>
            <th scope="col">Attack Bonus</th>
            <th scope="col">Damage Dice</th>
          </tr>
        </thead>
        <tbody>
          ${options.map(renderAttackRows).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderAttackRows(option) {
  const unavailable = option.available === false;
  const attackRoll = option.rolls?.find((roll) => roll.type === "attack" || roll.id === "attack");
  const damageRoll = option.rolls?.find((roll) => roll.type === "damage");
  const detailId = `detail-${escapeHtml(option.id)}`;
  return `
    <tr class="expandable-row ${unavailable ? "is-unavailable" : ""}" data-expand-target="${detailId}" aria-expanded="false">
      <td>${renderTypeBadge(option)}</td>
      <th scope="row">${escapeHtml(option.name)}</th>
      <td>${attackRoll ? `${escapeHtml(attackBonusLabel(attackRoll.formula))} ${renderRollIcon(option, attackRoll, unavailable)}` : ""}</td>
      <td>${damageRoll ? `${escapeHtml(damageRoll.formula)} ${renderDamageTypeIcon(damageRoll.damageType)} ${renderRollIcon(option, damageRoll, unavailable)}` : ""}</td>
    </tr>
    <tr class="option-detail-row" id="${detailId}" hidden>
      <td></td>
      <td colspan="3">
        <p>${escapeHtml(option.description || "")}</p>
        ${renderMeta(option)}
        ${renderWarnings(option.warnings)}
        ${unavailable ? renderReasons(option.unavailableReasons) : ""}
      </td>
    </tr>
  `;
}

function renderSpellTable(options) {
  return `
    <div class="option-table-wrap">
      <table class="option-table spell-table">
        <thead>
          <tr>
            <th scope="col">Action</th>
            <th scope="col">Spell</th>
            <th scope="col">Range</th>
            <th scope="col">DC</th>
            <th scope="col">Description</th>
            <th scope="col">Action Buttons</th>
          </tr>
        </thead>
        <tbody>
          ${options.map(renderSpellRows).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderSpellRows(option) {
  const unavailable = option.available === false;
  const detailId = `detail-${escapeHtml(option.id)}`;
  return `
    <tr class="expandable-row ${unavailable ? "is-unavailable" : ""}" data-expand-target="${detailId}" aria-expanded="false">
      <td>${renderCastingCostBadge(option)}</td>
      <th scope="row">${escapeHtml(option.name)}</th>
      <td>${escapeHtml(option.spell?.range ?? "")}</td>
      <td>${escapeHtml(spellDcLabel(option))}</td>
      <td>
        <p>${escapeHtml(option.description || "")}</p>
        ${renderMeta(option)}
        ${renderWarnings(option.warnings)}
        ${unavailable ? renderReasons(option.unavailableReasons) : ""}
      </td>
      <td>${renderOptionButtons(option, unavailable)}</td>
    </tr>
    <tr class="option-detail-row spell-detail-row" id="${detailId}" hidden>
      <td></td>
      <td colspan="5">
        ${renderSpellDetailCard(option)}
      </td>
    </tr>
  `;
}

function renderCastingCostBadge(option) {
  return `<span class="badge">${escapeHtml(castingCostLabel(option))}</span>`;
}

function renderTypeBadge(option) {
  return `<span class="badge">${escapeHtml(costLabel(option))}</span>`;
}

function renderRollIcon(option, roll, unavailable) {
  return `
    <button class="icon-btn" type="button" data-roll-option="${escapeHtml(option.id)}" data-roll-id="${escapeHtml(roll.id)}" title="${escapeHtml(roll.label)}" aria-label="${escapeHtml(`${option.name} ${roll.label}`)}" ${unavailable ? "disabled" : ""}>
      <span aria-hidden="true">d20</span>
    </button>
  `;
}

function renderDamageTypeIcon(type) {
  if (!type) return "";
  return `<span class="damage-icon" title="${escapeHtml(titleCase(type))} damage" aria-label="${escapeHtml(titleCase(type))} damage">${escapeHtml(type.slice(0, 1).toUpperCase())}</span>`;
}

function attackBonusLabel(formula) {
  const match = String(formula ?? "").match(/1d20([+-]\d+)?/i);
  return match?.[1] ?? "+0";
}

function toggleExpandedRow(root, row) {
  const target = root.querySelector(`#${CSS.escape(row.dataset.expandTarget)}`);
  if (!target) return;
  const expanded = row.getAttribute("aria-expanded") === "true";
  row.setAttribute("aria-expanded", String(!expanded));
  target.hidden = expanded;
}

function bindSpellDetailCards(root) {
  root.querySelectorAll(".spell-detail-row .srd-hover-card__close").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const detailRow = button.closest(".option-detail-row");
      detailRow.hidden = true;
      root.querySelector(`[data-expand-target="${CSS.escape(detailRow.id)}"]`)?.setAttribute("aria-expanded", "false");
    });
  });
}

function renderMeta(option) {
  if (!option.meta?.length) return "";
  return `<ul class="option-meta">${option.meta.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderReasons(reasons = []) {
  return `<p class="inline-message warning">${escapeHtml(reasons.join(" "))}</p>`;
}

function renderWarnings(warnings = []) {
  if (!warnings.length) return "";
  return `<p class="inline-message warning">${escapeHtml(warnings.join(" "))}</p>`;
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

function handleRoll(button, groups, stateManager, showToast) {
  const option = findOption(groups, button.dataset.rollOption);
  const roll = option?.rolls?.find((entry) => entry.id === button.dataset.rollId);
  if (!option || !roll) return;

  const result = roll.type === "damage"
    ? rollDamage({ formula: roll.formula, label: `${option.name} ${roll.label}` })
    : rollDice(roll.formula, { label: `${option.name} ${roll.label}`, type: roll.type });

  const summary = formatRollSummary(result);
  stateManager.logRoll(result, summary);
  showToast?.({ type: result.ok ? "info" : "error", message: summary });
}

function useOption(option, combatState, stateManager, modalApi) {
  if (option.spell?.concentration && combatState.current?.concentration && combatState.current.concentration !== option.name) {
    showConfirmModal(modalApi, {
      title: "Replace Concentration?",
      message: `Casting ${option.name} will end concentration on ${combatState.current.concentration}.`,
      confirmLabel: "Cast Spell",
      onConfirm: () => stateManager.useCombatOption(option)
    });
    return;
  }
  stateManager.useCombatOption(option);
}

function findOption(groups, id) {
  return Object.values(groups).flat().find((option) => option.id === id);
}

function costLabel(option) {
  if (option.cost?.bonus) return "Bonus";
  if (option.cost?.reaction) return "Reaction";
  if (option.cost?.movement) return "Movement";
  if (option.cost?.action) return "Action";
  if (option.cost?.object) return "Free";
  return option.resource ?? "Option";
}

function castingCostLabel(option) {
  if (option.cost?.bonus) return "Bonus";
  if (option.cost?.reaction) return "Reaction";
  if (option.cost?.action) return "Action";
  return "Special";
}

function spellDcLabel(option) {
  const dc = option.spell?.saveDc;
  const ability = option.spell?.saveAbility;
  if (!dc && !ability) return "";
  return [ability ? ability.toUpperCase() : null, dc ? `DC ${dc}` : null].filter(Boolean).join(" ");
}

function useLabel(option) {
  return option.source === "spell" ? "Cast" : option.cost?.movement ? "Use Move" : "Use";
}

function hasUseCost(option) {
  return option.cost?.action || option.cost?.bonus || option.cost?.reaction || option.cost?.object || option.cost?.resource;
}

function titleCase(value) {
  return String(value ?? "").replace(/\b\w/g, (char) => char.toUpperCase());
}

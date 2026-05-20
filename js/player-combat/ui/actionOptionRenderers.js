import { escapeHtml } from "./renderUtils.js";
import { renderSpellDetailCard } from "./spellDetailCard.js";

export function renderGroup(key, label, options, combatState) {
  if (key === "log") return renderLogGroup(label, combatState);
  return `
    <section class="option-group" aria-label="${escapeHtml(label)}">
      ${options.length ? renderOptionTable(key, options) : `<p class="inline-message">No ${escapeHtml(label.toLowerCase())} options yet.</p>`}
    </section>
  `;
}

export function toggleExpandedRow(root, row) {
  const target = root.querySelector(`#${CSS.escape(row.dataset.expandTarget)}`);
  if (!target) return;
  const expanded = row.getAttribute("aria-expanded") === "true";
  row.setAttribute("aria-expanded", String(!expanded));
  target.hidden = expanded;
}

export function bindSpellDetailCards(root) {
  root.querySelectorAll(".spell-detail-row .srd-hover-card__close").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const detailRow = button.closest(".option-detail-row");
      detailRow.hidden = true;
      root.querySelector(`[data-expand-target="${CSS.escape(detailRow.id)}"]`)?.setAttribute("aria-expanded", "false");
    });
  });
}

function renderOptionTable(group, options) {
  if (group === "spells") return renderSpellTable(options);
  return `
    <div class="option-table-wrap">
      <table class="option-table">
        <thead>
          <tr>
            <th scope="col">Type</th>
            <th class="attack-mode-col" scope="col">M/R</th>
            <th scope="col">Name</th>
            <th scope="col">Range</th>
            <th scope="col">Roll</th>
            <th scope="col">Damage / Notes</th>
            <th scope="col">Buttons</th>
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
      <td>${renderAttackMode(option)}</td>
      <th scope="row">
        ${escapeHtml(option.name)}
        <p>${escapeHtml(option.description || "")}</p>
      </th>
      <td>${escapeHtml(optionRangeLabel(option))}</td>
      <td>${renderPrimaryRoll(option, unavailable)}</td>
      <td>
        ${renderMeta(option)}
        ${renderAdditionalRollButtons(option, unavailable)}
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

function renderSpellTable(options) {
  return `
    <div class="option-table-wrap">
      <table class="option-table spell-table">
        <thead>
          <tr>
            <th scope="col">Action Type</th>
            <th class="spell-concentration-col" scope="col">C</th>
            <th class="attack-mode-col" scope="col">M/R</th>
            <th scope="col">Spell</th>
            <th scope="col">Range</th>
            <th scope="col">DC</th>
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
      <td>${renderConcentrationBadge(option)}</td>
      <td>${renderAttackMode(option)}</td>
      <th scope="row">${escapeHtml(option.name)}</th>
      <td>${escapeHtml(option.spell?.range ?? "")}</td>
      <td>${escapeHtml(spellDcLabel(option))}</td>
      <td>${renderOptionButtons(option, unavailable)}</td>
    </tr>
    <tr class="option-detail-row spell-detail-row" id="${detailId}" hidden>
      <td></td>
      <td></td>
      <td></td>
      <td colspan="4">
        ${renderSpellDetailCard(option)}
        ${renderWarnings(option.warnings)}
        ${unavailable ? renderReasons(option.unavailableReasons) : ""}
      </td>
    </tr>
  `;
}

function renderPrimaryRoll(option, unavailable) {
  const attackRoll = option.rolls?.find((roll) => roll.type === "attack" || roll.id === "attack");
  const damageRoll = option.rolls?.find((roll) => roll.type === "damage" && roll.id === "damage");
  const checkRoll = option.rolls?.find((roll) => roll.type === "check");
  const roll = attackRoll ?? checkRoll ?? damageRoll;
  if (!roll) return "";
  const label = attackRoll ? attackBonusLabel(roll.formula) : roll.formula;
  const damage = attackRoll && damageRoll
    ? `<small>${escapeHtml(damageRoll.formula)} ${renderDamageTypeIcon(damageRoll.damageType)}</small>`
    : "";
  return `${escapeHtml(label)} ${renderRollIcon(option, roll, unavailable)} ${damage}`;
}

function renderCastingCostBadge(option) {
  return `<span class="badge">${escapeHtml(castingCostLabel(option))}</span>`;
}

function renderConcentrationBadge(option) {
  if (!option.spell?.concentration) return "";
  return `<span class="badge concentration-badge" title="Requires concentration" aria-label="Requires concentration">C</span>`;
}

function renderTypeBadge(option) {
  return `<span class="badge">${escapeHtml(costLabel(option))}</span>`;
}

function renderAttackMode(option) {
  if (!isAttackOption(option)) return "";
  const type = attackMode(option);
  const label = type === "ranged" ? "R" : "M";
  return `<span class="badge attack-mode-badge" title="${escapeHtml(titleCase(type))} attack" aria-label="${escapeHtml(titleCase(type))} attack">${label}</span>`;
}

function optionRangeLabel(option) {
  if (option.spell?.range) return option.spell.range;
  if (option.range?.label) return option.range.label;
  if (option.tags?.includes("melee")) return "5 ft";
  return "";
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

function renderMeta(option) {
  if (!option.meta?.length) return "";
  return `<ul class="option-meta">${option.meta.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderAdditionalRollButtons(option, unavailable) {
  const primaryIds = new Set(["attack", "damage", "athletics", "spellAttack", "healing"]);
  const rolls = (option.rolls ?? []).filter((roll) => !primaryIds.has(roll.id));
  if (!rolls.length) return "";
  return `
    <div class="button-row option-button-row">
      ${rolls.map((roll) => `
        <button class="btn btn-secondary" type="button" data-roll-option="${escapeHtml(option.id)}" data-roll-id="${escapeHtml(roll.id)}" ${unavailable ? "disabled" : ""}>
          ${escapeHtml(roll.label)}
        </button>
      `).join("")}
    </div>
  `;
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

function attackBonusLabel(formula) {
  const match = String(formula ?? "").match(/1d20([+-]\d+)?/i);
  return match?.[1] ?? "+0";
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

function isAttackOption(option) {
  return option.tags?.includes("attack") || option.rolls?.some((roll) => roll.type === "attack");
}

function attackMode(option) {
  if (option.range?.type) return option.range.type;
  if (option.tags?.includes("ranged")) return "ranged";
  const text = `${option.description ?? ""} ${option.spell?.range ?? ""} ${option.spell?.reference?.description ?? ""}`.toLowerCase();
  if (/\bmelee spell attack\b|\btouch\b/.test(text)) return "melee";
  if (/\branged spell attack\b|\b\d+\s*(feet|ft\.?)\b/.test(text)) return "ranged";
  return "melee";
}

function titleCase(value) {
  return String(value ?? "").replace(/\b\w/g, (char) => char.toUpperCase());
}

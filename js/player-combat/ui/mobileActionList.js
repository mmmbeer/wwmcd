import { escapeHtml } from "./renderUtils.js";
import { getPlannedOptionForSlot, getPlannedTurn, isOptionPlanned } from "./plannedTurnState.js";

export function renderMobileActionList(group, label, options, combatState, { hideUnavailable = false } = {}) {
  if (group === "log") return renderLog(label, combatState);
  const visibleOptions = options.length
    ? options.map((option) => renderActionRow(option, group)).join("")
    : `<p class="inline-message">No ${escapeHtml(label.toLowerCase())} options yet.</p>`;

  return `
    <section class="action-list-shell" aria-label="${escapeHtml(label)}">
      <div class="action-list-toolbar">
        <span class="section-label">${escapeHtml(label)}</span>
        <label class="availability-toggle">
          <input type="checkbox" data-toggle-unavailable ${hideUnavailable ? "checked" : ""}>
          <span>Available only</span>
        </label>
      </div>
      <div class="action-list" role="list">
        ${visibleOptions}
      </div>
    </section>
  `;
}

export function toggleActionDetail(root, optionId) {
  const panel = root.querySelector(`[data-action-detail="${CSS.escape(optionId)}"]`);
  const toggle = root.querySelector(`[data-toggle-action-detail="${CSS.escape(optionId)}"]`);
  if (!panel || !toggle) return;
  const expanded = toggle.getAttribute("aria-expanded") === "true";
  toggle.setAttribute("aria-expanded", String(!expanded));
  toggle.querySelector("span").textContent = expanded ? "v" : "^";
  panel.hidden = expanded;
}

export function renderPlannedTurnBar(snapshot) {
  const plan = getPlannedTurn();
  const speed = Number(snapshot.activeCharacter?.combat?.speed?.walk ?? 0);
  const used = Number(snapshot.combatState?.turn?.movementUsed ?? 0) + plan.movementUsed;
  const remaining = Math.max(0, speed - used);
  const hasPlan = Boolean(plan.action || plan.bonusAction || plan.reaction || plan.freeActions.length || plan.movementUsed);
  return `
    <section class="planned-turn-bar" aria-label="Planned turn">
      <div class="planned-turn-title">
        <span class="section-label">Planned Turn</span>
        ${hasPlan ? "" : `<small>Tap actions to build your turn.</small>`}
      </div>
      <div class="planned-chips">
        ${plannedActionChips(plan)}
        ${chip("Bonus", plan.bonusAction?.name)}
        ${chip("React", plan.reaction?.name)}
        ${plan.freeActions.map((option) => chip("Free", option.name)).join("")}
        ${chip("Move", `${remaining} ft left`)}
      </div>
      <div class="planned-actions">
        <button class="btn btn-secondary" type="button" data-plan-clear ${hasPlan ? "" : "disabled"}>Clear</button>
        <button class="btn btn-primary" type="button" data-plan-confirm ${hasPlan ? "" : "disabled"}>Act now</button>
      </div>
    </section>
  `;
}

function renderActionRow(option, group) {
  const unavailable = option.available === false;
  const selected = isOptionPlanned(option);
  const rowKind = rowKindFor(option, group);
  return `
    <article class="action-entry ${selected ? "is-selected" : ""} ${unavailable ? "is-unavailable" : ""}" role="listitem">
      <div class="action-row action-row--${escapeHtml(rowKind)}">
        <button class="action-expand-toggle" type="button" data-toggle-action-detail="${escapeHtml(option.id)}" aria-expanded="false" aria-label="Show details for ${escapeHtml(option.name)}">
          <span aria-hidden="true">v</span>
        </button>
        <button class="action-select-main"
          type="button"
          data-plan-option="${escapeHtml(option.id)}"
          aria-pressed="${selected ? "true" : "false"}"
          ${unavailable ? `aria-label="${escapeHtml(`${option.name}. Unavailable: ${unavailableText(option)}`)}"` : ""}>
          ${renderRowCells(option, rowKind, selected)}
        </button>
      </div>
      ${renderRecommendationSummary(option)}
      <div class="action-detail-panel" data-action-detail="${escapeHtml(option.id)}" hidden>
        ${renderActionDetail(option)}
      </div>
    </article>
  `;
}

function renderRowCells(option, rowKind, selected) {
  const buttonLabel = plannedButtonLabel(option, rowKind, selected);
  if (rowKind === "spell") {
    return `
      ${renderConcentrationCell(option)}
      ${renderCostBadge(option)}
      <span class="action-fact">${escapeHtml(spellLevelLabel(option))}</span>
      ${renderNameCell(option)}
      <span class="action-fact">${escapeHtml(rangeLabel(option) || "-")}</span>
      <span class="action-fact">${escapeHtml(hitDcLabel(option) || "-")}</span>
      ${renderActionButtonLabel(buttonLabel)}
    `;
  }

  if (rowKind === "attack") {
    return `
      ${renderCostBadge(option)}
      ${renderTypeBadge(attackModeLabel(option).toLowerCase())}
      ${renderNameCell(option)}
      <span class="action-fact">${escapeHtml(rangeLabel(option) || "-")}</span>
      <span class="action-fact">${escapeHtml(hitDcLabel(option) || "-")}</span>
      ${renderDamageCell(option)}
      ${renderActionButtonLabel(buttonLabel)}
    `;
  }

  return `
    ${renderSourceBadge(option)}
    ${renderNameCell(option)}
    <span class="action-fact action-fact--empty" aria-hidden="true"></span>
    ${renderActionButtonLabel(buttonLabel)}
  `;
}

function renderActionDetail(option) {
  return `
    <div class="detail-grid">
      ${detailFact("Source", option.source ? titleCase(option.source) : "")}
      ${detailFact("Range", rangeLabel(option))}
      ${detailFact("Roll", primaryRollLabel(option))}
      ${detailFact("Resource", resourceLabel(option))}
    </div>
    ${descriptionText(option) ? `<p>${escapeHtml(descriptionText(option))}</p>` : `<p>No additional description is available.</p>`}
    ${option.recommendation?.reasons?.length ? `<p class="recommendation-detail"><strong>Recommendation:</strong> ${escapeHtml(option.recommendation.reasons.join(" · "))}</p>` : ""}
    ${option.meta?.length ? `<ul class="option-meta">${option.meta.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
    ${option.recommendation?.warnings?.length ? `<p class="inline-message warning">${escapeHtml(option.recommendation.warnings.join(" "))}</p>` : ""}
    ${option.warnings?.length ? `<p class="inline-message warning">${escapeHtml(option.warnings.join(" "))}</p>` : ""}
    ${option.available === false && option.unavailableReasons?.length ? `<p class="inline-message warning">${escapeHtml(option.unavailableReasons.join(" "))}</p>` : ""}
  `;
}

function renderRecommendationSummary(option) {
  const recommendation = option.recommendation;
  if (!recommendation) return "";
  const reasons = recommendation.reasons ?? [];
  return `
    <div class="recommendation-row-summary" aria-label="Recommendation details">
      <span class="recommendation-rank">#${escapeHtml(recommendation.rank)}</span>
      <span class="recommendation-score">${escapeHtml(recommendation.score)} pts</span>
      ${reasons.slice(0, 3).map((reason) => `<span class="recommendation-reason">${escapeHtml(reason)}</span>`).join("")}
    </div>
  `;
}

function renderNameCell(option) {
  return `
    <span class="action-name-cell">
      <span class="action-name-line">
        <strong>${escapeHtml(option.name)}</strong>
      </span>
    </span>
  `;
}

function renderActionButtonLabel(label) {
  return `<span class="action-select-mark">${escapeHtml(label)}</span>`;
}

function plannedButtonLabel(option, rowKind, selected) {
  if (isSequencedAttackOption(option)) return attackSequenceButtonLabel(option, selected);
  if (selected) return "Planned";
  if (option.cost?.movement) return "Add to turn";
  const planned = getPlannedOptionForSlot(option);
  if (planned && planned.id !== option.id) return `Replace ${planned.name}`;
  return "Add to turn";
}

function renderCostBadge(option) {
  const type = typeLabel(option);
  return `<span class="type-badge type-${escapeHtml(type.key)}">${escapeHtml(type.label)}</span>`;
}

function renderSourceBadge(option) {
  const source = option.source === "basic" ? "basic" : option.source === "feature" ? "feature" : option.spell ? "spell" : String(option.source || "basic").toLowerCase();
  return renderTypeBadge(source);
}

function renderConcentrationCell(option) {
  if (!option.spell?.concentration) return `<span class="concentration-cell" aria-hidden="true"></span>`;
  return `<span class="concentration-cell concentration-badge" title="Requires concentration" aria-label="Requires concentration">C</span>`;
}

function renderTypeBadge(type) {
  const key = String(type || "basic").toLowerCase();
  return `<span class="type-badge type-${escapeHtml(key)}">${escapeHtml(key)}</span>`;
}

function renderLog(label, combatState) {
  const log = combatState.log ?? [];
  return `
    <section class="action-list-shell" aria-labelledby="option-log">
      <div class="action-list-toolbar">
        <h3 id="option-log" class="section-label">${escapeHtml(label)}</h3>
      </div>
      ${log.length ? `
        <ol class="log-list">
          ${log.slice(0, 8).map((entry) => `
            <li class="list-item">
              <span>${escapeHtml(entry.message)}</span>
              <small>R${escapeHtml(entry.round)}</small>
            </li>
          `).join("")}
        </ol>
      ` : `<p class="inline-message">No combat log yet.</p>`}
    </section>
  `;
}

function chip(label, value) {
  return `
    <span class="planned-chip ${value ? "has-value" : ""}">
      <small>${escapeHtml(label)}</small>
      <strong>${escapeHtml(value || "-")}</strong>
    </span>
  `;
}

function plannedActionChips(plan) {
  const attacks = plan.actionAttacks ?? [];
  if (!attacks.length) return chip("Action", plan.action?.name);
  const capacity = attackCapacity(plan.action);
  const planned = attacks.map((option, index) => chip(`Atk ${index + 1}`, option.name)).join("");
  const empty = Array.from({ length: Math.max(0, capacity - attacks.length) }, (_, index) => {
    return chip(`Atk ${attacks.length + index + 1}`, "-");
  }).join("");
  return `${planned}${empty}`;
}

function isSequencedAttackOption(option) {
  const plan = getPlannedTurn();
  return isAttackAction(option) && (plan.actionAttacks?.length || isAttackAction(plan.action));
}

function attackSequenceButtonLabel(option, selected) {
  const plan = getPlannedTurn();
  const capacity = attackCapacity(plan.action ?? option);
  const count = Number(plan.actionAttacks?.length ?? 0);
  if (count < capacity) return selected ? `Add again (${count + 1}/${capacity})` : `Add attack ${count + 1}/${capacity}`;
  if (selected) return "Planned";
  return `Start new Attack`;
}

function isAttackAction(option) {
  return Boolean(option?.cost?.action)
    && (option.tags?.includes("attack") || option.rolls?.some((roll) => roll.type === "attack" || roll.id === "attack"));
}

function attackCapacity(option) {
  return Math.max(1, Number(option?.attack?.count ?? 1));
}

function detailFact(label, value) {
  if (!value) return "";
  return `
    <div class="detail-fact">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function typeLabel(option) {
  if (option.cost?.bonus) return { key: "bonus", label: "bonus" };
  if (option.cost?.reaction) return { key: "reaction", label: "reaction" };
  if (option.cost?.object || !option.cost?.action || option.cost?.movement) return { key: "free", label: "free" };
  return { key: "action", label: "action" };
}

function rowKindFor(option, group) {
  if (group === "spells" || option.source === "spell" || option.spell) return "spell";
  if (group === "attacks" || option.source === "weapon" || option.tags?.includes("weapon") || option.tags?.includes("unarmed")) return "attack";
  return "action";
}

function unavailableText(option) {
  return option.available === false ? option.unavailableReasons?.join(" ") || "Unavailable" : "";
}

function rangeLabel(option) {
  return option.spell?.range ?? option.range?.label ?? (option.tags?.includes("melee") ? "5 ft" : "");
}

function hitDcLabel(option) {
  const attack = option.rolls?.find((roll) => roll.type === "attack" || roll.id === "attack");
  if (attack) return String(attack.formula ?? "").match(/1d20([+-]\d+)?/i)?.[1] ?? "+0";
  const dc = option.spell?.saveDc;
  const ability = option.spell?.saveAbility;
  return [ability ? ability.toUpperCase() : null, dc ? `DC ${dc}` : null].filter(Boolean).join(" ");
}

function spellLevelLabel(option) {
  const level = Number(option.spell?.level ?? 0);
  return level > 0 ? String(level) : "Cantrip";
}

function attackModeLabel(option) {
  const type = option.range?.type ?? (option.tags?.includes("ranged") ? "ranged" : "melee");
  return titleCase(type);
}

function damageLabel(option) {
  const damage = option.rolls?.find((roll) => roll.type === "damage" && roll.id === "damage");
  return damage?.formula ?? "";
}

function renderDamageCell(option) {
  const damage = option.rolls?.find((roll) => roll.type === "damage" && roll.id === "damage");
  if (!damage) return `<span class="action-fact">-</span>`;
  return `
    <span class="action-fact damage-cell">
      <span>${escapeHtml(damage.formula)}</span>
      ${damage.damageType ? renderDamageTypeIcon(damage.damageType) : ""}
    </span>
  `;
}

function renderDamageTypeIcon(type) {
  const label = titleCase(type);
  return `
    <span class="damage-type-icon" title="${escapeHtml(label)} damage" aria-label="${escapeHtml(label)} damage">
      ${damageTypeSvg(type)}
    </span>
  `;
}

function damageTypeSvg(type) {
  const key = String(type ?? "").toLowerCase();
  const commonAttrs = `viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"`;
  if (/bludgeoning/.test(key)) {
    return `<svg ${commonAttrs}><circle cx="12" cy="12" r="7"></circle><path d="M7 17 17 7"></path></svg>`;
  }
  if (/piercing/.test(key)) {
    return `<svg ${commonAttrs}><path d="M12 3 17 21 12 17 7 21Z"></path></svg>`;
  }
  if (/slashing/.test(key)) {
    return `<svg ${commonAttrs}><path d="M5 19C10 9 15 5 21 3 19 9 15 14 5 19Z"></path></svg>`;
  }
  if (/fire/.test(key)) {
    return `<svg ${commonAttrs}><path d="M12 21c4-2 6-5 4-9-2 2-3 2-3 0 0-3-2-5-4-7 1 5-4 6-4 11 0 3 3 5 7 5Z"></path></svg>`;
  }
  if (/cold/.test(key)) {
    return `<svg ${commonAttrs}><path d="M12 3v18M5 7l14 10M19 7 5 17"></path></svg>`;
  }
  if (/lightning|thunder/.test(key)) {
    return `<svg ${commonAttrs}><path d="M13 2 5 14h6l-1 8 9-13h-6Z"></path></svg>`;
  }
  return `<svg ${commonAttrs}><path d="M12 3 21 12 12 21 3 12Z"></path></svg>`;
}

function descriptionText(option) {
  return option.longDescription
    ?? option.spell?.reference?.description
    ?? option.featureAction?.description
    ?? option.description
    ?? "";
}

function primaryRollLabel(option) {
  const roll = option.rolls?.find((entry) => entry.type === "attack" || entry.id === "attack")
    ?? option.rolls?.find((entry) => entry.type === "check")
    ?? option.rolls?.find((entry) => entry.type === "damage" && entry.id === "damage")
    ?? option.rolls?.[0];
  return roll?.formula ?? "";
}

function resourceLabel(option) {
  const resource = option.cost?.resource;
  if (!resource) return option.resource ?? "";
  return [resource.name ?? resource.id, resource.amount ? `x${resource.amount}` : null].filter(Boolean).join(" ");
}

function titleCase(value) {
  return String(value ?? "").replace(/\b\w/g, (char) => char.toUpperCase());
}

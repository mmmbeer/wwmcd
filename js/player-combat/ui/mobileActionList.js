import { escapeHtml } from "./renderUtils.js";
import { getPlannedTurn, isOptionPlanned } from "./plannedTurnState.js";

export function renderMobileActionList(group, label, options, combatState, { hideUnavailable = false } = {}) {
  if (group === "log") return renderLog(label, combatState);
  const visibleOptions = options.length
    ? options.map((option) => renderActionRow(option)).join("")
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
  toggle.querySelector("span").textContent = expanded ? "Details" : "Hide";
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
        ${chip("Action", plan.action?.name)}
        ${chip("Bonus", plan.bonusAction?.name)}
        ${chip("React", plan.reaction?.name)}
        ${plan.freeActions.map((option) => chip("Free", option.name)).join("")}
        ${chip("Move", `${remaining} ft left`)}
      </div>
      <div class="planned-actions">
        <button class="btn btn-secondary" type="button" data-plan-clear ${hasPlan ? "" : "disabled"}>Clear</button>
        <button class="btn btn-primary" type="button" data-plan-confirm ${hasPlan ? "" : "disabled"}>Confirm Turn</button>
      </div>
    </section>
  `;
}

function renderActionRow(option) {
  const unavailable = option.available === false;
  const selected = isOptionPlanned(option);
  return `
    <article class="action-entry ${selected ? "is-selected" : ""} ${unavailable ? "is-unavailable" : ""}" role="listitem">
      <button class="action-row"
        type="button"
        data-plan-option="${escapeHtml(option.id)}"
        aria-pressed="${selected ? "true" : "false"}"
        ${unavailable ? `aria-label="${escapeHtml(`${option.name}. Unavailable: ${unavailableText(option)}`)}"` : ""}>
        <span class="action-icon" aria-hidden="true">${escapeHtml(iconFor(option))}</span>
        <span class="action-name-cell">
          <span class="action-name-line">
            <strong>${escapeHtml(option.name)}</strong>
            ${renderBadge(option)}
          </span>
          <small>${escapeHtml(subtitle(option))}</small>
        </span>
        <span class="action-fact">${escapeHtml(rangeLabel(option) || "-")}</span>
        <span class="action-fact">${escapeHtml(hitDcLabel(option) || "-")}</span>
        <span class="action-effect">
          <strong>${escapeHtml(effectLabel(option) || "-")}</strong>
          <small>${escapeHtml(noteLabel(option))}</small>
        </span>
        <span class="action-select-mark" aria-hidden="true">${selected ? "✓" : "+"}</span>
      </button>
      <button class="action-expand-toggle" type="button" data-toggle-action-detail="${escapeHtml(option.id)}" aria-expanded="false" aria-label="Show details for ${escapeHtml(option.name)}">
        <span aria-hidden="true">Details</span>
      </button>
      <div class="action-detail-panel" data-action-detail="${escapeHtml(option.id)}" hidden>
        ${renderActionDetail(option)}
      </div>
    </article>
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
    ${option.meta?.length ? `<ul class="option-meta">${option.meta.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
    ${option.warnings?.length ? `<p class="inline-message warning">${escapeHtml(option.warnings.join(" "))}</p>` : ""}
    ${option.available === false && option.unavailableReasons?.length ? `<p class="inline-message warning">${escapeHtml(option.unavailableReasons.join(" "))}</p>` : ""}
  `;
}

function renderBadge(option) {
  const type = typeLabel(option);
  return `<span class="type-badge type-${escapeHtml(type.key)}">${escapeHtml(type.label)}</span>`;
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
  if (option.spell) return { key: "spell", label: costLabel(option) };
  if (option.cost?.bonus) return { key: "bonus", label: "Bonus" };
  if (option.cost?.reaction) return { key: "reaction", label: "Reaction" };
  if (option.cost?.movement) return { key: "movement", label: "Move" };
  if (option.cost?.object || !option.cost?.action) return { key: "free", label: "Free" };
  return { key: "action", label: "Action" };
}

function costLabel(option) {
  if (option.cost?.bonus) return "Bonus";
  if (option.cost?.reaction) return "Reaction";
  return "Spell";
}

function iconFor(option) {
  if (option.cost?.movement) return ">";
  if (option.cost?.reaction) return "R";
  if (option.cost?.bonus) return "*";
  if (option.spell) return "S";
  if (option.tags?.includes("attack") || option.rolls?.some((roll) => roll.type === "attack")) return "A";
  if (option.cost?.object || !option.cost?.action) return ".";
  return "+";
}

function subtitle(option) {
  return [option.source ? titleCase(option.source) : null, option.resource, unavailableText(option)].filter(Boolean).join(" | ");
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

function effectLabel(option) {
  const damage = option.rolls?.find((roll) => roll.type === "damage" && roll.id === "damage");
  if (damage) return [damage.formula, titleCase(damage.damageType)].filter(Boolean).join(" ");
  if (option.movement?.remaining !== undefined) return `Move ${option.movement.step ?? 5} ft`;
  return option.effect?.activeEffect ?? option.description ?? option.meta?.[0] ?? "";
}

function noteLabel(option) {
  return option.meta?.find((entry) => String(entry).length < 56) ?? option.notes ?? "";
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

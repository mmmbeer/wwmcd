import { escapeHtml } from "./renderUtils.js";
import { isDependentOption } from "../recommendations/recommendationPrerequisites.js";
import { isOptionPlanned } from "./plannedTurnState.js";
import { renderResourceIcon } from "./resourceIcon.js";

const rowHtmlCache = new Map();
const ROW_CACHE_LIMIT = 600;

export function renderMobileActionList(group, label, options, combatState, { hideUnavailable = false } = {}) {
  if (group === "log") return renderLog(label, combatState);
  const visibleOptions = options.length
    ? options.map((option) => renderCachedActionRow(option, group)).join("")
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

function renderActionRow(option, group) {
  const unavailable = option.available === false;
  const selected = isOptionPlanned(option);
  const rowKind = rowKindFor(option, group);
  const aiRecommended = option.recommendation?.source === "ai";
  return `
    <article class="action-entry ${selected ? "is-selected" : ""} ${unavailable ? "is-unavailable" : ""} ${aiRecommended ? "is-ai-recommended" : ""}" role="listitem">
      <div class="action-row action-row--${escapeHtml(rowKind)}">
        <button class="action-expand-toggle" type="button" data-toggle-action-detail="${escapeHtml(option.id)}" aria-expanded="false" aria-label="Show details for ${escapeHtml(option.name)}">
          <span aria-hidden="true">v</span>
        </button>
        <button class="action-select-main"
          type="button"
          data-use-option="${escapeHtml(option.id)}"
          aria-pressed="${selected ? "true" : "false"}"
          ${unavailable ? "disabled" : ""}
          ${unavailable ? `aria-label="${escapeHtml(`${option.name}. Unavailable: ${unavailableText(option)}`)}"` : ""}>
          ${renderRowCells(option, rowKind, selected)}
        </button>
      </div>
      <div class="action-detail-panel" data-action-detail="${escapeHtml(option.id)}" hidden>
        ${renderActionDetail(option)}
      </div>
    </article>
  `;
}

function renderCachedActionRow(option, group) {
  const key = actionRowCacheKey(option, group);
  const cached = rowHtmlCache.get(key);
  if (cached) return cached;
  const html = renderActionRow(option, group);
  rowHtmlCache.set(key, html);
  if (rowHtmlCache.size > ROW_CACHE_LIMIT) {
    rowHtmlCache.delete(rowHtmlCache.keys().next().value);
  }
  return html;
}

function renderRowCells(option, rowKind, selected) {
  const buttonLabel = plannedButtonLabel(option, rowKind, selected);
  return `
    ${renderResourceIndicator(option)}
    ${renderSourceBadge(option)}
    ${renderCostBadge(option)}
    ${renderNameCell(option)}
    <span class="action-fact">${escapeHtml(rangeLabel(option) || "-")}</span>
    ${renderDamageCell(option)}
    <span class="action-fact">${escapeHtml(hitDcLabel(option) || "-")}</span>
    ${renderActionButtonLabel(buttonLabel)}
  `;
}

function renderActionDetail(option) {
  return `
    <div class="detail-grid">
      ${detailFact("Source", option.source ? titleCase(option.source) : "")}
      ${detailFact("Range", rangeLabel(option))}
      ${detailFact("Roll", primaryRollLabel(option))}
      ${detailFact("Damage", damageLabel(option))}
      ${detailFact("Resource", resourceLabel(option))}
    </div>
    ${descriptionText(option) ? `<p>${escapeHtml(descriptionText(option))}</p>` : `<p>No additional description is available.</p>`}
    ${renderRecommendationSummary(option)}
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
  const isAi = recommendation.source === "ai";
  return `
    <div class="recommendation-row-summary ${isAi ? "is-ai-recommendation" : ""}" aria-label="Recommendation details">
      <strong>${isAi ? "AI Recommendation" : "Recommendation"}</strong>
      ${reasons.slice(0, 3).map((reason) => `<span class="recommendation-reason">${escapeHtml(reason)}</span>`).join("")}
      ${renderAiRecommendationDetail(recommendation)}
    </div>
  `;
}

function renderAiRecommendationDetail(recommendation) {
  if (recommendation.source !== "ai") return "";
  const details = [
    ["Guidance", recommendation.guidance],
    ["Why", recommendation.summary || recommendation.explanation],
    ["Confidence", recommendation.confidence],
    ["Legality", recommendation.legality],
    ["Risk", recommendation.riskLevel],
    ["Resources", recommendation.resourcesUsed?.join(", ")],
    ["Concentration", recommendation.concentrationImpact],
    ["Assumptions", recommendation.assumptions?.join(", ")]
  ].filter(([, value]) => value);
  const pieces = Array.isArray(recommendation.pieces) ? recommendation.pieces : [];
  if (!details.length && !pieces.length) return "";
  return `
    <div class="ai-recommendation-detail">
      ${renderAiPlanPieces(pieces)}
      ${details.map(([label, value]) => `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`).join("")}
    </div>
  `;
}

function renderAiPlanPieces(pieces) {
  if (!pieces.length) return "";
  return `
    <div class="recommendation-set-pieces">
      ${pieces.map((piece) => `
        <div class="recommendation-set-piece">
          <span>${escapeHtml(piece.slot || "Option")}</span>
          <strong>${escapeHtml(piece.name || piece.optionId || "Unknown option")}</strong>
          ${piece.explanation ? `<small>${escapeHtml(piece.explanation)}</small>` : ""}
        </div>
      `).join("")}
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
  return "Use";
}

function renderCostBadge(option) {
  const type = typeLabel(option);
  return `<span class="type-badge type-${escapeHtml(type.key)}">${escapeHtml(type.label)}</span>`;
}

function renderSourceBadge(option) {
  const source = sourceType(option);
  return `<span class="source-cell source-${escapeHtml(source.key)}" title="${escapeHtml(source.label)}" aria-label="${escapeHtml(source.label)}">${escapeHtml(source.short)}</span>`;
}

function sourceType(option) {
  if (option.spell || option.source === "spell") return { key: "spell", label: "Spell", short: "S" };
  if (option.source === "weapon" || option.tags?.includes("weapon") || option.tags?.includes("unarmed")) return { key: "weapon", label: "Weapon", short: "W" };
  if (option.source === "feature" || option.featureAction) return { key: "feature", label: "Feature", short: "F" };
  if (option.source === "resource") return { key: "resource", label: "Resource", short: "R" };
  return { key: "basic", label: "Basic", short: "B" };
}

function renderResourceIndicator(option) {
  if (option.spell?.concentration) {
    return `<span class="resource-cell concentration-badge" title="Requires concentration" aria-label="Requires concentration">C</span>`;
  }
  const resource = option.cost?.resource;
  if (!resource) return `<span class="resource-cell" aria-hidden="true"></span>`;
  return `
    <span class="resource-cell">${renderResourceIcon(resource)}</span>
  `;
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
  if (isDependentOption(option) && !option.cost?.action && !option.cost?.bonus && !option.cost?.reaction) return { key: "rider", label: "rider" };
  if (option.cost?.bonus) return { key: "bonus", label: "bonus action" };
  if (option.cost?.reaction) return { key: "reaction", label: "reaction" };
  if (option.cost?.movement) return { key: "movement", label: "movement" };
  if (option.cost?.object) return { key: "free", label: "object" };
  if (!option.cost?.action) return { key: "free", label: "free" };
  return { key: "action", label: "action" };
}

function rowKindFor(option, group) {
  if (group === "spells") return "spell";
  if (group === "attacks") return "attack";
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

function damageLabel(option) {
  const damage = primaryDamageRoll(option);
  return [damage?.formula, damage?.damageType].filter(Boolean).join(" ");
}

function renderDamageCell(option) {
  const damage = primaryDamageRoll(option);
  if (!damage) return `<span class="action-fact">-</span>`;
  return `
    <span class="action-fact damage-cell">
      <span>${escapeHtml(damage.formula)}</span>
      ${damage.damageType ? `<span class="damage-type-label">${escapeHtml(damage.damageType)}</span>${renderDamageTypeIcon(damage.damageType)}` : ""}
    </span>
  `;
}

function primaryDamageRoll(option) {
  return option.rolls?.find((roll) => roll.type === "damage" && roll.id === "damage")
    ?? option.rolls?.find((roll) => roll.type === "damage")
    ?? null;
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

function actionRowCacheKey(option, group) {
  return [
    group,
    option.id,
    option.name,
    option.available === false ? "unavailable" : "available",
    isOptionPlanned(option) ? "planned" : "open",
    option.recommendation?.source,
    option.recommendation?.score,
    option.recommendation?.reasons?.join("~"),
    option.recommendation?.warnings?.join("~"),
    option.cost?.action ? "action" : "",
    option.cost?.bonus ? "bonus" : "",
    option.cost?.reaction ? "reaction" : "",
    option.cost?.movement ? "movement" : "",
    option.cost?.object ? "object" : "",
    option.cost?.resource?.id,
    option.cost?.resource?.amount,
    option.spell?.level,
    option.spell?.concentration ? "concentration" : "",
    option.range?.label,
    option.spell?.range,
    option.rolls?.map((roll) => `${roll.id}:${roll.type}:${roll.formula}:${roll.damageType}`).join(","),
    option.meta?.join("~"),
    option.warnings?.join("~"),
    option.unavailableReasons?.join("~"),
    descriptionText(option)
  ].filter((value) => value !== undefined && value !== null).join("|");
}

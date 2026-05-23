import { escapeHtml } from "./renderUtils.js";
import { isDependentOption } from "../recommendations/recommendationPrerequisites.js";

export function renderFollowupButton(option) {
  const badge = optionTypeLabel(option);
  const resource = followupResourceLabel(option);
  const description = followupDescription(option);
  const descriptionId = `followup-description-${escapeHtml(option.id)}`;
  return `
    <div class="followup-entry">
      <button class="followup-expand" type="button" data-followup-toggle="${escapeHtml(option.id)}" aria-expanded="false" aria-controls="${descriptionId}" aria-label="Show description for ${escapeHtml(option.name)}">
        <span aria-hidden="true">v</span>
      </button>
      <button class="btn btn-secondary followup-option" type="button" data-followup-use="${escapeHtml(option.id)}">
        <span class="type-badge type-${escapeHtml(badge.key)}">${escapeHtml(badge.label)}</span>
        <span class="followup-resource">${escapeHtml(resource || "-")}</span>
        <span class="followup-name">${escapeHtml(option.name)}</span>
      </button>
      <div class="followup-description" id="${descriptionId}" data-followup-description="${escapeHtml(option.id)}" hidden>
        ${description ? escapeHtml(description) : "No additional description is available."}
      </div>
    </div>
  `;
}

export function toggleFollowupDescription(root, optionId) {
  const escapedId = cssEscape(optionId);
  const panel = root.querySelector(`[data-followup-description="${escapedId}"]`);
  const toggle = root.querySelector(`[data-followup-toggle="${escapedId}"]`);
  if (!panel || !toggle) return;
  const expanded = toggle.getAttribute("aria-expanded") === "true";
  toggle.setAttribute("aria-expanded", String(!expanded));
  toggle.querySelector("span").textContent = expanded ? "v" : "^";
  panel.hidden = expanded;
}

function cssEscape(value) {
  return globalThis.CSS?.escape ? CSS.escape(value) : String(value).replace(/["\\]/g, "\\$&");
}

function followupResourceLabel(option) {
  const resource = option.cost?.resource;
  if (resource) {
    return [resource.name ?? resource.id, resource.amount && Number(resource.amount) !== 1 ? `x${resource.amount}` : null]
      .filter(Boolean)
      .join(" ");
  }
  if (typeof option.resource === "string") return option.resource;
  if (option.resource?.name) return option.resource.name;
  return "";
}

function followupDescription(option) {
  return option.longDescription
    ?? option.spell?.reference?.description
    ?? option.featureAction?.description
    ?? option.description
    ?? (Array.isArray(option.meta) ? option.meta.join(" ") : "")
    ?? "";
}

function optionTypeLabel(option) {
  if (isDependentOption(option) && !option.cost?.action && !option.cost?.bonus && !option.cost?.reaction) return { key: "rider", label: "rider" };
  if (option.cost?.bonus) return { key: "bonus", label: "bonus action" };
  if (option.cost?.reaction) return { key: "reaction", label: "reaction" };
  if (option.cost?.movement) return { key: "movement", label: "movement" };
  if (option.cost?.action && isSecondAttackOption(option)) return { key: "action", label: "second attack" };
  if (option.cost?.action) return { key: "action", label: "action" };
  if (option.cost?.object) return { key: "free", label: "object" };
  return { key: "free", label: "free" };
}

function isSecondAttackOption(option) {
  return option.tags?.includes("attack")
    || option.rolls?.some((roll) => roll.type === "attack" || roll.id === "attack");
}

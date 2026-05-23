import { escapeHtml } from "./renderUtils.js";
import { isDependentOption } from "../recommendations/recommendationPrerequisites.js";

export function renderFollowupButton(option) {
  const badge = optionTypeLabel(option);
  const resource = followupResourceLabel(option);
  return `
    <button class="btn btn-secondary followup-option" type="button" data-followup-use="${escapeHtml(option.id)}">
      <span class="type-badge type-${escapeHtml(badge.key)}">${escapeHtml(badge.label)}</span>
      <span class="followup-resource">${escapeHtml(resource || "-")}</span>
      <span class="followup-name">${escapeHtml(option.name)}</span>
    </button>
  `;
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

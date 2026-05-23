import { renderResourceIcon, resourceLabel } from "./resourceIcon.js";
import { escapeHtml } from "./renderUtils.js";

export function shouldConfirmActionUse({ hadExistingModal = false } = {}) {
  return !hadExistingModal;
}

export function confirmActionUse(modalApi, option) {
  return new Promise((resolve) => {
    let resolved = false;
    const done = (value) => {
      if (resolved) return;
      resolved = true;
      resolve(value);
    };
    modalApi.showModal({
      title: "Confirm Action",
      body: renderActionUseConfirmation(option),
      onClose: () => done(false),
      actions: [
        { label: "Cancel", variant: "secondary", onClick: () => done(false) },
        {
          label: "Use Action",
          variant: "primary",
          close: false,
          onClick: () => {
            done(true);
            modalApi.close();
          }
        }
      ]
    });
  });
}

export function renderActionUseConfirmation(option) {
  const details = actionDetails(option);
  const description = actionDescription(option);
  return `
    <div class="action-confirmation">
      <div class="action-confirmation-heading">
        <span class="type-badge">${escapeHtml(actionTypeLabel(option))}</span>
        <strong>${escapeHtml(option?.name ?? "Selected action")}</strong>
      </div>
      ${details.length ? `
        <dl class="action-confirmation-details">
          ${details.map((detail) => `
            <div>
              <dt>${escapeHtml(detail.label)}</dt>
              <dd>${detail.html}</dd>
            </div>
          `).join("")}
        </dl>
      ` : ""}
      ${description ? `<p class="action-confirmation-description">${escapeHtml(description)}</p>` : ""}
      ${option?.warnings?.length ? `
        <div class="inline-message warning">
          ${option.warnings.map((warning) => escapeHtml(warning)).join("<br>")}
        </div>
      ` : ""}
    </div>
  `;
}

function actionDetails(option) {
  return [
    resourceDetail(option),
    rangeDetail(option),
    rollDetail(option),
    damageDetail(option)
  ].filter(Boolean);
}

function resourceDetail(option) {
  const resource = option?.cost?.resource ?? option?.resource;
  const label = resourceCostLabel(resource);
  if (!label) return null;
  return {
    label: "Resource",
    html: `${renderResourceIcon(resourceIconValue(resource, label), { className: "resource-badge action-confirmation-resource" })}<span>${escapeHtml(label)}</span>`
  };
}

function rangeDetail(option) {
  const label = option?.range?.label ?? option?.spell?.range;
  if (!label) return null;
  return { label: "Range", html: escapeHtml(label) };
}

function rollDetail(option) {
  const rolls = option?.rolls?.filter((roll) => roll?.formula && roll.type !== "damage") ?? [];
  if (!rolls.length) return null;
  return {
    label: "Roll",
    html: escapeHtml(rolls.map((roll) => `${roll.label ?? roll.type ?? "Roll"} ${roll.formula}`).join(", "))
  };
}

function damageDetail(option) {
  const damage = option?.rolls?.filter((roll) => roll?.formula && roll.type === "damage") ?? [];
  if (!damage.length) return null;
  return {
    label: "Damage",
    html: escapeHtml(damage.map((roll) => `${roll.formula}${roll.damageType ? ` ${roll.damageType}` : ""}`).join(", "))
  };
}

function resourceIconValue(resource, label) {
  if (typeof resource === "object" && resource?.name) return resource;
  return { name: label };
}

function resourceCostLabel(resource) {
  if (!resource) return "";
  if (typeof resource === "string") return resource;
  if (resource.type === "spellSlot") {
    return `Level ${resource.level ?? "?"} Spell Slot`;
  }
  return resourceLabel(resource);
}

function actionDescription(option) {
  return [
    option?.longDescription,
    option?.description,
    option?.spell?.reference?.description,
    option?.spell?.description,
    option?.featureAction?.description,
    option?.meta?.join("\n")
  ].find(Boolean) ?? "";
}

function actionTypeLabel(option) {
  if (option?.cost?.bonus) return "bonus action";
  if (option?.cost?.reaction) return "reaction";
  if (option?.cost?.movement) return "movement";
  if (option?.cost?.object) return "object";
  if (option?.cost?.action) return "action";
  if (option?.cost?.resource) return "resource";
  return "free";
}

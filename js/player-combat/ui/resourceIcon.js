import { escapeHtml } from "./renderUtils.js";

export function renderResourceIcon(resource, { className = "resource-badge", empty = "" } = {}) {
  const label = resourceLabel(resource);
  if (!label) return empty;
  return `
    <span class="${escapeHtml(className)}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">
      ${resourceIconSvg(label)}
    </span>
  `;
}

export function resourceLabel(resource) {
  if (!resource) return "";
  if (typeof resource === "string") return resource;
  return [resource.name ?? resource.id, resource.amount && Number(resource.amount) !== 1 ? `x${resource.amount}` : null]
    .filter(Boolean)
    .join(" ");
}

function resourceIconSvg(label) {
  const name = String(label ?? "").toLowerCase();
  const commonAttrs = `viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false"`;
  if (/ki|focus|discipline/.test(name)) return `<svg ${commonAttrs}><path d="M12 3v18M3 12h18M5 5l14 14M19 5 5 19"></path></svg>`;
  if (/superiority|command|dice|die/.test(name)) return `<svg ${commonAttrs}><path d="M12 3 21 8v8l-9 5-9-5V8Z"></path><path d="M12 3v18M3 8l9 5 9-5"></path></svg>`;
  if (/spell|slot/.test(name)) return `<svg ${commonAttrs}><path d="M12 3a7 7 0 0 0-7 7c0 5 7 11 7 11s7-6 7-11a7 7 0 0 0-7-7Z"></path><path d="M9 10h6"></path></svg>`;
  return `<svg ${commonAttrs}><circle cx="12" cy="12" r="7"></circle><path d="M12 7v10M7 12h10"></path></svg>`;
}

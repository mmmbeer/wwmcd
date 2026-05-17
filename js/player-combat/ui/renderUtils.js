export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

export function formatFeet(value) {
  return `${Number(value || 0)} ft`;
}

export function button(label, className = "btn-secondary") {
  return `<button class="btn ${className}" type="button">${escapeHtml(label)}</button>`;
}

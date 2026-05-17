import { escapeHtml } from "./renderUtils.js";

export function renderReferenceStatus(root, snapshot) {
  const reference = snapshot.referenceData;
  const overall = document.querySelector("#reference-overall-status");

  if (!reference) {
    root.innerHTML = `<p class="inline-message">Loading reference files.</p>`;
    overall.textContent = "Loading";
    overall.className = "status-pill";
    return;
  }

  const failed = reference.statuses.filter((status) => !status.ok);
  overall.textContent = failed.length ? `${failed.length} failed` : "Ready";
  overall.className = `status-pill ${failed.length ? "is-error" : "is-ready"}`;

  root.innerHTML = reference.statuses.map((status) => `
    <div class="status-item">
      <span class="status-label">${escapeHtml(status.name)}</span>
      <span class="status-value">${status.ok ? `${status.count} loaded` : "Failed"}</span>
      ${status.error ? `<small>${escapeHtml(status.error)}</small>` : ""}
    </div>
  `).join("");
}

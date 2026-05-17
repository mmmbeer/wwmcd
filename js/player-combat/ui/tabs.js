import { escapeHtml } from "./renderUtils.js";

export function renderActionTabs(root, snapshot) {
  const log = snapshot.combatState?.log ?? [];
  const tabs = [
    ["Recommended", "Rules recommendations arrive in the next phase."],
    ["Actions", "Basic actions and attacks arrive in the next phase."],
    ["Bonus", "Bonus action cards arrive in the next phase."],
    ["Movement", "Movement options arrive in the next phase."],
    ["Spells", "Spell action cards arrive in the next phase."],
    ["Resources", "Resource spending arrives in the next phase."],
    ["Log", log.length ? log.map((entry) => entry.message).slice(0, 4).join(" | ") : "No combat log yet."]
  ];

  root.innerHTML = `
    <div class="tab-grid">
      ${tabs.map(([title, body]) => `
        <article class="tab-placeholder">
          <strong>${escapeHtml(title)}</strong>
          <p>${escapeHtml(body)}</p>
        </article>
      `).join("")}
    </div>
  `;
}

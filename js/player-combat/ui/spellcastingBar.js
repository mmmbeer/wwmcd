import { escapeHtml } from "./renderUtils.js";

export function renderSpellcastingBar(root, snapshot, stateManager) {
  const character = snapshot.activeCharacter;
  const state = snapshot.combatState;
  if (!root) return;

  const slots = Object.entries(character?.resources?.spellSlots ?? {});
  if (!character || !state || !slots.length) {
    root.innerHTML = "";
    return;
  }

  root.innerHTML = `
    <section class="spellcasting-bar" aria-label="Spellcasting">
      <button class="concentration-status ${state.current.concentration ? "is-active" : ""}" type="button" data-concentration-toggle="true" aria-pressed="${state.current.concentration ? "true" : "false"}">
        <span>Concentration</span>
      </button>
      ${slots.map(([level, value]) => renderLevel(level, value, state.resourcesUsed?.spellSlots?.[level])).join("")}
    </section>
  `;

  root.querySelector("[data-concentration-toggle]")?.addEventListener("click", () => {
    stateManager.updateCombatState({
      current: {
        concentration: state.current.concentration ? null : "Concentrating"
      }
    });
  });

  root.querySelectorAll("[data-spell-level]").forEach((button) => {
    button.addEventListener("click", () => {
      const spellLevel = button.dataset.spellLevel === "all" ? null : Number(button.dataset.spellLevel);
      window.dispatchEvent(new CustomEvent("combat:select-option-group", {
        detail: { group: "spells", spellLevel }
      }));
    });
  });
}

function renderLevel(level, value, usedValue) {
  const max = spellSlotMax(value);
  const used = Math.min(Number(usedValue ?? 0), max);
  return `
    <button class="spell-level-status ${used >= max ? "is-spent" : ""}" type="button" data-spell-level="${escapeHtml(level)}">
      <span>${escapeHtml(level)}</span>
      <span class="spell-slot-boxes">${renderBoxes(max, used)}</span>
    </button>
  `;
}

function renderBoxes(max, used) {
  return Array.from({ length: max }, (_, index) => (
    `<span class="spell-slot-box ${index < used ? "is-used" : ""}" aria-hidden="true">${index < used ? "✓" : ""}</span>`
  )).join("");
}

function spellSlotMax(value) {
  const max = value && typeof value === "object" ? Number(value.available ?? value.max ?? value.value ?? 0) : Number(value ?? 0);
  return Number.isFinite(max) ? max : 0;
}

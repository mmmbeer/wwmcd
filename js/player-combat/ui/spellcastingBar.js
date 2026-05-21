import { escapeHtml } from "./renderUtils.js";

export function renderSpellcastingBar(root, snapshot, stateManager) {
  const character = snapshot.activeCharacter;
  const state = snapshot.combatState;
  if (!root) return;

  const slots = Object.entries(character?.resources?.spellSlots ?? {});
  const limitedResources = uniqueResources([
    ...(character?.resources?.classResources ?? []),
    ...(character?.resources?.limitedUses ?? [])
  ]).filter((resource) => Number(resource.max ?? 0) > 0);
  if (!character || !state || (!slots.length && !limitedResources.length)) {
    root.innerHTML = "";
    return;
  }

  root.innerHTML = `
    <section class="spellcasting-bar" aria-label="Limited resources">
      <span class="section-label">Resources</span>
      <button class="concentration-status ${state.current.concentration ? "is-active" : ""}" type="button" data-concentration-toggle="true" aria-pressed="${state.current.concentration ? "true" : "false"}">
        <span>Conc.</span>
      </button>
      ${slots.map(([level, value]) => renderLevel(level, value, state.resourcesUsed?.spellSlots?.[level])).join("")}
      ${limitedResources.map((resource) => renderResource(resource, state.resourcesUsed?.classResources?.[resource.id])).join("")}
    </section>
  `;

  root.querySelector("[data-concentration-toggle]")?.addEventListener("click", () => {
    stateManager.updateCombatState({
      current: {
        concentration: state.current.concentration ? null : "Concentrating",
        concentrationSource: state.current.concentration ? null : "manual"
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

  root.querySelectorAll("[data-resource-view]").forEach((button) => {
    button.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("combat:select-option-group", {
        detail: { group: "resources" }
      }));
    });
  });
}

function renderLevel(level, value, usedValue) {
  const max = spellSlotMax(value);
  const used = Math.min(Number(usedValue ?? 0), max);
  return `
    <button class="spell-level-status ${used >= max ? "is-spent" : ""}" type="button" data-spell-level="${escapeHtml(level)}">
      <span>${escapeHtml(ordinal(level))}</span>
      <span class="spell-slot-boxes">${renderBoxes(max, used)}</span>
      <strong>${escapeHtml(max - used)}/${escapeHtml(max)}</strong>
    </button>
  `;
}

function renderBoxes(max, used) {
  return Array.from({ length: max }, (_, index) => (
    `<span class="spell-slot-box ${index < used ? "is-used" : ""}" aria-hidden="true"></span>`
  )).join("");
}

function spellSlotMax(value) {
  const max = value && typeof value === "object" ? Number(value.available ?? value.max ?? value.value ?? 0) : Number(value ?? 0);
  return Number.isFinite(max) ? max : 0;
}

function renderResource(resource, usedValue) {
  const max = Number(resource.max ?? 0);
  const used = Math.min(Number(usedValue ?? 0), max);
  return `
    <button class="spell-level-status resource-status ${used >= max ? "is-spent" : ""}" type="button" data-resource-view="${escapeHtml(resource.id)}" title="${escapeHtml(resource.name)}">
      <span>${escapeHtml(resource.name)}</span>
      <span class="spell-slot-boxes">${renderBoxes(max, used)}</span>
      <strong>${escapeHtml(max - used)}/${escapeHtml(max)}</strong>
    </button>
  `;
}

function ordinal(level) {
  return { 1: "1st", 2: "2nd", 3: "3rd" }[level] ?? `${level}th`;
}

function uniqueResources(resources) {
  const seen = new Set();
  return resources.filter((resource) => {
    const key = resource.id || resource.name;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

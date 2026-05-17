import { showConfirmModal } from "./modal.js";
import { escapeHtml } from "./renderUtils.js";

export function renderCombatStatePanel(root, snapshot, { stateManager, modalApi }) {
  const character = snapshot.activeCharacter;
  const state = snapshot.combatState;
  const reference = snapshot.referenceData;

  if (!character || !state) {
    root.innerHTML = `<p class="inline-message">Combat controls appear after character import.</p>`;
    return;
  }

  root.innerHTML = `
    <div class="control-grid">
      ${numberControl("hp", "Current HP", state.current.hp)}
      ${numberControl("tempHp", "Temp HP", state.current.tempHp)}
      ${numberControl("ac", "AC", state.current.ac)}
      ${numberControl("movement", "Movement Used", state.turn.movementUsed)}
    </div>
    <div class="button-row">
      <button class="btn btn-secondary" type="button" data-move="-5">-5 ft</button>
      <button class="btn btn-secondary" type="button" data-move="5">+5 ft</button>
      <button class="btn btn-secondary" type="button" data-action="add-condition">Add Condition</button>
      <button class="btn btn-secondary" type="button" data-action="set-concentration">Set Concentration</button>
      <button class="btn btn-danger" type="button" data-action="reset-combat">Reset Combat</button>
    </div>
    <h3>Conditions</h3>
    ${renderConditions(state.current.conditions)}
    <h3>Concentration</h3>
    <p class="inline-message">${escapeHtml(state.current.concentration || "None")}</p>
    <h3>Spell Slots</h3>
    ${renderSpellSlots(character.resources.spellSlots, state.resourcesUsed.spellSlots)}
    <h3>Limited Resources</h3>
    ${renderLimitedResources(character.resources, state.resourcesUsed.classResources)}
  `;

  bindNumber(root, "hp", (value) => updateCurrent(stateManager, { hp: value }));
  bindNumber(root, "tempHp", (value) => updateCurrent(stateManager, { tempHp: value }));
  bindNumber(root, "ac", (value) => updateCurrent(stateManager, { ac: value }));
  bindNumber(root, "movement", (value) => stateManager.updateCombatState({ turn: { movementUsed: value } }));

  root.querySelectorAll("[data-move]").forEach((button) => {
    button.addEventListener("click", () => stateManager.useMovement(Number(button.dataset.move)));
  });

  root.querySelector("[data-action='add-condition']").addEventListener("click", () => {
    openConditionModal({ modalApi, reference, state, stateManager });
  });

  root.querySelector("[data-action='set-concentration']").addEventListener("click", () => {
    openTextModal({
      modalApi,
      title: "Concentration",
      label: "Spell or effect",
      value: state.current.concentration ?? "",
      onSave: (value) => updateCurrent(stateManager, { concentration: value || null })
    });
  });

  root.querySelector("[data-action='reset-combat']").addEventListener("click", () => {
    showConfirmModal(modalApi, {
      title: "Reset Combat?",
      message: "This clears current combat state without deleting the imported character.",
      confirmLabel: "Reset",
      onConfirm: () => stateManager.resetCombatState(character.id)
    });
  });

  root.querySelectorAll("[data-remove-condition]").forEach((button) => {
    button.addEventListener("click", () => {
      const next = state.current.conditions.filter((name) => name !== button.dataset.removeCondition);
      updateCurrent(stateManager, { conditions: next });
    });
  });

  root.querySelectorAll("[data-slot-dec]").forEach((button) => {
    button.addEventListener("click", () => stateManager.adjustSpellSlotUsed(button.dataset.slotDec, -1));
  });

  root.querySelectorAll("[data-slot-inc]").forEach((button) => {
    button.addEventListener("click", () => stateManager.adjustSpellSlotUsed(button.dataset.slotInc, 1));
  });

  root.querySelectorAll("[data-slot-reset]").forEach((button) => {
    button.addEventListener("click", () => stateManager.resetSpellSlots(button.dataset.slotReset));
  });

  root.querySelectorAll("[data-slot-used]").forEach((input) => {
    input.addEventListener("change", () => stateManager.setSpellSlotUsed(input.dataset.slotUsed, input.value));
  });

  root.querySelector("[data-action='reset-slots']")?.addEventListener("click", () => {
    stateManager.resetSpellSlots();
  });

  root.querySelectorAll("[data-resource-dec]").forEach((button) => {
    button.addEventListener("click", () => stateManager.adjustClassResourceUsed(button.dataset.resourceDec, -1));
  });

  root.querySelectorAll("[data-resource-inc]").forEach((button) => {
    button.addEventListener("click", () => stateManager.adjustClassResourceUsed(button.dataset.resourceInc, 1));
  });

  root.querySelectorAll("[data-resource-reset]").forEach((button) => {
    button.addEventListener("click", () => stateManager.resetClassResources(button.dataset.resourceReset));
  });

  root.querySelectorAll("[data-resource-used]").forEach((input) => {
    input.addEventListener("change", () => stateManager.setClassResourceUsed(input.dataset.resourceUsed, input.value));
  });

  root.querySelector("[data-action='reset-resources']")?.addEventListener("click", () => {
    stateManager.resetClassResources();
  });
}

function numberControl(name, label, value) {
  return `
    <div class="field">
      <label for="combat-${name}">${label}</label>
      <input id="combat-${name}" data-number="${name}" type="number" inputmode="numeric" value="${Number(value || 0)}">
    </div>
  `;
}

function bindNumber(root, name, onChange) {
  root.querySelector(`[data-number='${name}']`).addEventListener("change", (event) => {
    onChange(Number(event.target.value || 0));
  });
}

function updateCurrent(stateManager, patch) {
  stateManager.updateCombatState({ current: patch });
}

function renderConditions(conditions) {
  if (!conditions.length) return `<p class="inline-message">No active conditions.</p>`;
  return `
    <ul class="condition-list">
      ${conditions.map((condition) => `
        <li class="list-item">
          <span>${escapeHtml(condition)}</span>
          <button class="btn btn-secondary" type="button" data-remove-condition="${escapeHtml(condition)}">Remove</button>
        </li>
      `).join("")}
    </ul>
  `;
}

function renderSpellSlots(slots, usedSlots) {
  const entries = Object.entries(slots ?? {});
  if (!entries.length) return `<p class="inline-message">No spell slots found.</p>`;
  return `
    <div class="button-row">
      <button class="btn btn-secondary" type="button" data-action="reset-slots">Reset Slots</button>
    </div>
    <div class="status-grid">
      ${entries.map(([level, count]) => {
        const max = spellSlotMax(count);
        const used = Math.min(Number(usedSlots?.[level] ?? 0), max);
        const remaining = Math.max(0, max - used);
        return `
        <div class="status-item">
          <span class="status-label">Level ${escapeHtml(level)}</span>
          <span class="status-value">${remaining} remaining</span>
          <div class="slot-controls" aria-label="Level ${escapeHtml(level)} spell slot controls">
            <button class="btn btn-secondary" type="button" data-slot-dec="${escapeHtml(level)}" aria-label="Decrease level ${escapeHtml(level)} used slots">-</button>
            <input data-slot-used="${escapeHtml(level)}" type="number" inputmode="numeric" min="0" max="${max}" value="${used}" aria-label="Level ${escapeHtml(level)} used slots">
            <button class="btn btn-secondary" type="button" data-slot-inc="${escapeHtml(level)}" aria-label="Increase level ${escapeHtml(level)} used slots">+</button>
            <button class="btn btn-secondary" type="button" data-slot-reset="${escapeHtml(level)}">Reset</button>
          </div>
          <small>${used} / ${max} used</small>
        </div>
      `;
      }).join("")}
    </div>
  `;
}

function renderLimitedResources(resources, usedResources) {
  const entries = uniqueResources([
    ...(resources?.classResources ?? []),
    ...(resources?.limitedUses ?? [])
  ]);
  if (!entries.length) return `<p class="inline-message">No limited resources found.</p>`;
  return `
    <div class="button-row">
      <button class="btn btn-secondary" type="button" data-action="reset-resources">Reset Resources</button>
    </div>
    <div class="status-grid">
      ${entries.map((resource) => {
        const max = Number(resource.max ?? 0);
        const used = Math.min(Number(usedResources?.[resource.id] ?? 0), max);
        const remaining = Math.max(0, max - used);
        return `
        <div class="status-item">
          <span class="status-label">${escapeHtml(resource.name)}</span>
          <span class="status-value">${remaining} remaining</span>
          <div class="slot-controls" aria-label="${escapeHtml(resource.name)} controls">
            <button class="btn btn-secondary" type="button" data-resource-dec="${escapeHtml(resource.id)}" aria-label="Decrease ${escapeHtml(resource.name)} used">-</button>
            <input data-resource-used="${escapeHtml(resource.id)}" type="number" inputmode="numeric" min="0" max="${max}" value="${used}" aria-label="${escapeHtml(resource.name)} used">
            <button class="btn btn-secondary" type="button" data-resource-inc="${escapeHtml(resource.id)}" aria-label="Increase ${escapeHtml(resource.name)} used">+</button>
            <button class="btn btn-secondary" type="button" data-resource-reset="${escapeHtml(resource.id)}">Reset</button>
          </div>
          <small>${used} / ${max} used${resource.reset ? ` - ${escapeHtml(resource.reset)}` : ""}</small>
        </div>
      `;
      }).join("")}
    </div>
  `;
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

function spellSlotMax(value) {
  const max = value && typeof value === "object" ? Number(value.available ?? value.max ?? value.value ?? 0) : Number(value ?? 0);
  return Number.isFinite(max) ? max : 0;
}

function openConditionModal({ modalApi, reference, state, stateManager }) {
  const select = document.createElement("select");
  const conditionNames = (reference?.indexes.conditionIndexByName ? [...reference.indexes.conditionIndexByName.values()] : [])
    .map((condition) => condition.name)
    .sort();

  for (const name of conditionNames) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    select.append(option);
  }

  const field = document.createElement("div");
  field.className = "field";
  field.innerHTML = `<label for="condition-select">Condition</label>`;
  select.id = "condition-select";
  field.append(select);

  modalApi.showModal({
    title: "Add Condition",
    body: field,
    actions: [
      { label: "Cancel", variant: "secondary" },
      {
        label: "Add",
        variant: "primary",
        onClick: () => {
          const conditions = [...new Set([...(state.current.conditions ?? []), select.value].filter(Boolean))];
          updateCurrent(stateManager, { conditions });
        }
      }
    ]
  });
}

function openTextModal({ modalApi, title, label, value, onSave }) {
  const input = document.createElement("input");
  input.value = value;
  const field = document.createElement("div");
  field.className = "field";
  field.innerHTML = `<label for="text-modal-input">${escapeHtml(label)}</label>`;
  input.id = "text-modal-input";
  field.append(input);

  modalApi.showModal({
    title,
    body: field,
    actions: [
      { label: "Clear", variant: "secondary", onClick: () => onSave("") },
      { label: "Save", variant: "primary", onClick: () => onSave(input.value.trim()) }
    ]
  });
}

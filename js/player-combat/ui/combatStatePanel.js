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
    <div class="status-grid">
      ${entries.map(([level, count]) => `
        <div class="status-item">
          <span class="status-label">Level ${escapeHtml(level)}</span>
          <span class="status-value">${Number(usedSlots?.[level] ?? 0)} / ${Number(count || 0)} used</span>
        </div>
      `).join("")}
    </div>
  `;
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

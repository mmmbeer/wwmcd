import { escapeHtml, formatFeet } from "./renderUtils.js";

const FALLBACK_CONDITIONS = [
  "Blinded",
  "Charmed",
  "Deafened",
  "Frightened",
  "Grappled",
  "Incapacitated",
  "Invisible",
  "Paralyzed",
  "Petrified",
  "Poisoned",
  "Prone",
  "Restrained",
  "Stunned",
  "Unconscious"
];

export function renderCombatStatusBar(root, snapshot, { stateManager, modalApi }) {
  const character = snapshot.activeCharacter;
  const state = snapshot.combatState;
  if (!root) return;

  if (!character || !state) {
    root.innerHTML = "";
    return;
  }

  const maxHp = Number(character.combat?.maxHp ?? 0);
  root.innerHTML = `
    <section class="combat-status-bar" aria-label="Combat status">
      <div class="status-inline">
        <label for="status-hp">HP:</label>
        <input id="status-hp" data-status-number="hp" type="number" inputmode="numeric" value="${Number(state.current.hp ?? 0)}">
        <span>/ ${maxHp}</span>
        <label for="status-temp">Temp:</label>
        <input id="status-temp" data-status-number="tempHp" type="number" inputmode="numeric" value="${Number(state.current.tempHp ?? 0)}">
      </div>
      <div class="status-inline status-basics">
        <strong>AC: ${escapeHtml(state.current.ac ?? character.combat?.ac ?? 10)}</strong>
        <strong>Speed: ${escapeHtml(formatFeet(character.combat?.speed?.walk ?? 0))}</strong>
      </div>
      <div class="condition-row">
        <span class="condition-label">Conditions:</span>
        <div class="condition-badges">
          ${renderConditionBadges(state.current.conditions ?? [])}
          <button class="condition-add" type="button" data-status-action="add-condition" aria-label="Add condition">+</button>
        </div>
      </div>
    </section>
  `;

  bindNumber(root, "hp", (value) => updateCurrent(stateManager, { hp: value }));
  bindNumber(root, "tempHp", (value) => updateCurrent(stateManager, { tempHp: value }));

  root.querySelectorAll("[data-remove-condition]").forEach((button) => {
    button.addEventListener("click", () => {
      const next = (state.current.conditions ?? []).filter((name) => name !== button.dataset.removeCondition);
      updateCurrent(stateManager, { conditions: next });
    });
  });

  root.querySelector("[data-status-action='add-condition']").addEventListener("click", () => {
    openConditionModal({ modalApi, reference: snapshot.referenceData, state, stateManager });
  });
}

function renderConditionBadges(conditions) {
  if (!conditions.length) return `<span class="condition-empty">None</span>`;
  return conditions.map((condition) => `
    <span class="condition-badge">
      ${escapeHtml(condition)}
      <button type="button" data-remove-condition="${escapeHtml(condition)}" aria-label="Remove ${escapeHtml(condition)}">x</button>
    </span>
  `).join("");
}

function bindNumber(root, name, onChange) {
  root.querySelector(`[data-status-number='${name}']`).addEventListener("change", (event) => {
    onChange(Number(event.target.value || 0));
  });
}

function updateCurrent(stateManager, patch) {
  stateManager.updateCombatState({ current: patch });
}

function openConditionModal({ modalApi, reference, state, stateManager }) {
  const select = document.createElement("select");
  const conditionNames = getConditionNames(reference);

  for (const name of conditionNames) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    select.append(option);
  }

  const field = document.createElement("div");
  field.className = "field";
  field.innerHTML = `<label for="status-condition-select">Condition</label>`;
  select.id = "status-condition-select";
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

function getConditionNames(reference) {
  const loaded = reference?.indexes?.conditionIndexByName
    ? [...reference.indexes.conditionIndexByName.values()].map((condition) => condition.name).filter(Boolean)
    : [];
  return (loaded.length ? loaded : FALLBACK_CONDITIONS).sort();
}

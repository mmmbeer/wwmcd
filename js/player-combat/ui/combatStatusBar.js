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
  const hp = Number(state.current.hp ?? 0);
  const hpPercent = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0;
  root.innerHTML = `
    <section class="combat-status-bar" aria-label="Combat status">
      <div class="character-crest" aria-hidden="true">${escapeHtml(crest(character.name))}</div>
      <div class="character-status-main">
        <div class="character-name-line">${escapeHtml(character.name ?? "Unnamed Character")}</div>
        <div class="character-subtitle-line">${escapeHtml(characterSubtitle(character))}</div>
      </div>
      <div class="vital-stat-grid">
        <label class="vital-stat vital-stat--hp">
          <span>HP</span>
          <strong><input data-status-number="hp" type="number" inputmode="numeric" value="${hp}"> / ${maxHp}</strong>
          <i class="hp-meter" aria-label="Hit points ${hp} of ${maxHp}"><i style="width: ${hpPercent}%"></i></i>
        </label>
        <label class="vital-stat vital-stat--temp">
          <span>Tmp</span>
          <strong><input data-status-number="tempHp" type="number" inputmode="numeric" value="${Number(state.current.tempHp ?? 0)}"></strong>
        </label>
        <div class="vital-stat">
          <span>AC</span>
          <strong>${escapeHtml(state.current.ac ?? character.combat?.ac ?? 10)}</strong>
        </div>
        <div class="vital-stat">
          <span>SPD</span>
          <strong>${escapeHtml(formatFeet(character.combat?.speed?.walk ?? 0))}</strong>
        </div>
        <div class="vital-stat">
          <span>INIT</span>
          <strong>${escapeHtml(initiativeLabel(character))}</strong>
        </div>
      </div>
      <div class="condition-row compact-condition-row">
        <span class="condition-label">Conditions</span>
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

function crest(name) {
  return String(name ?? "?").trim().slice(0, 1).toUpperCase() || "?";
}

function characterSubtitle(character) {
  const race = character.race?.name ?? character.ancestry?.name ?? character.race ?? "Unknown";
  const classes = (character.classes ?? []).map((entry) => [
    entry.name,
    entry.subclass ? `(${entry.subclass})` : null
  ].filter(Boolean).join(" ")).join(" / ") || "Unknown class";
  return `${race} - ${classes} - Level ${character.level || "?"}`;
}

function initiativeLabel(character) {
  const value = Number(character.combat?.initiative ?? character.combat?.initiativeBonus ?? character.stats?.dexMod ?? 0);
  return value >= 0 ? `+${value}` : String(value);
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

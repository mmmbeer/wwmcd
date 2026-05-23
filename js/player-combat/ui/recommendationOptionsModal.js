import { getRecommendationQuestionConfig } from "../recommendations/recommendationScoring.js";
import { escapeHtml } from "./renderUtils.js";

const PRIMARY_QUESTIONS = ["goal", "situation", "distance"];
const ADVANCED_QUESTIONS = ["difficulty", "resources", "rollMode", "concentration"];

export function openRecommendationOptionsModal({
  modalApi,
  groups,
  answers,
  character,
  combatState,
  title = "Recommendation Options",
  includeSituationNotes = false,
  initialNotes = "",
  onApply
}) {
  const body = document.createElement("form");
  body.className = "recommendation-options-form";
  body.innerHTML = renderForm({ groups, answers, character, combatState, includeSituationNotes, initialNotes });
  bindDefaultResourceBehavior(body, { character, combatState });

  modalApi.showModal({
    title,
    body,
    actions: [
      { label: "Cancel", variant: "secondary" },
      {
        label: "Apply",
        variant: "primary",
        close: false,
        onClick: () => {
          onApply?.(readForm(body));
          modalApi.close();
        }
      }
    ]
  });
}

export function renderRecommendationOptionsControls(groups, answers, { character, combatState } = {}) {
  const questions = getRecommendationQuestionConfig(groups, answers, { character, combatState });
  const primary = questions.filter((question) => PRIMARY_QUESTIONS.includes(question.id));
  const advanced = questions.filter((question) => ADVANCED_QUESTIONS.includes(question.id));
  return `
    <div class="recommendation-options-grid">
      ${primary.map(renderSelect).join("")}
    </div>
    ${advanced.length ? `
      <details class="recommendation-advanced-panel">
        <summary>Advanced options</summary>
        <div class="recommendation-options-grid">
          ${advanced.map(renderSelect).join("")}
        </div>
      </details>
    ` : ""}
  `;
}

export function readRecommendationOptionsForm(root) {
  return Object.fromEntries(
    [...root.querySelectorAll("[data-recommendation-answer]")]
      .map((select) => [select.dataset.recommendationAnswer, select.value])
  );
}

function renderForm({ groups, answers, character, combatState, includeSituationNotes, initialNotes }) {
  return `
    ${renderRecommendationOptionsControls(groups, answers, { character, combatState })}
    ${includeSituationNotes ? `
      <label class="field ai-notes-field">
        <span class="field-label">Describe the situation</span>
        <textarea data-ai-notes placeholder="Enemy position, defenses, ally danger, objective, hazards, or table rulings.">${escapeHtml(initialNotes)}</textarea>
      </label>
    ` : ""}
  `;
}

function bindDefaultResourceBehavior(root, { character, combatState }) {
  const situation = root.querySelector("[data-recommendation-answer='situation']");
  const resources = root.querySelector("[data-recommendation-answer='resources']");
  if (!situation || !resources) return;
  let resourcesTouched = false;
  resources.addEventListener("change", () => {
    resourcesTouched = true;
  });
  situation.addEventListener("change", () => {
    if (resourcesTouched) return;
    resources.value = defaultResourceValue({
      character,
      combatState,
      situation: situation.value
    });
  });
}

function defaultResourceValue({ character, combatState, situation }) {
  const ratio = remainingSpendableResourceRatio(character, combatState);
  if (ratio !== null && ratio < 0.2) return "conserve";
  return situation && situation !== "single" ? "spend" : "normal";
}

function remainingSpendableResourceRatio(character, combatState) {
  const resources = [
    ...Object.entries(character?.resources?.spellSlots ?? {}).map(([level, value]) => ({
      max: resourceMax(value),
      used: Number(combatState?.resourcesUsed?.spellSlots?.[level] ?? 0)
    })),
    ...(character?.resources?.classResources ?? []).map((resource) => ({
      max: Number(resource?.max ?? 0),
      used: Number(combatState?.resourcesUsed?.classResources?.[resource?.id] ?? 0)
    })),
    ...(character?.resources?.limitedUses ?? []).map((resource) => ({
      max: Number(resource?.max ?? 0),
      used: Number(combatState?.resourcesUsed?.classResources?.[resource?.id] ?? 0)
    }))
  ].filter((resource) => resource.max > 0);
  if (!resources.length) return null;
  const total = resources.reduce((sum, resource) => sum + resource.max, 0);
  const remaining = resources.reduce((sum, resource) => sum + Math.max(0, resource.max - resource.used), 0);
  return remaining / total;
}

function resourceMax(value) {
  if (value && typeof value === "object") return Number(value.available ?? value.max ?? value.value ?? 0);
  return Number(value ?? 0);
}

function renderSelect(question) {
  return `
    <label class="recommendation-question">
      <span>${escapeHtml(question.label)}</span>
      <select data-recommendation-answer="${escapeHtml(question.id)}">
        ${question.options.map(([value, label]) => `
          <option value="${escapeHtml(value)}" ${question.value === value ? "selected" : ""}>${escapeHtml(label)}</option>
        `).join("")}
      </select>
    </label>
  `;
}

function readForm(root) {
  return {
    answers: readRecommendationOptionsForm(root),
    notes: root.querySelector("[data-ai-notes]")?.value ?? ""
  };
}

import { getRecommendationQuestionConfig } from "../recommendations/recommendationScoring.js";
import { escapeHtml } from "./renderUtils.js";

const PRIMARY_QUESTIONS = ["goal", "situation", "distance", "resources"];
const ADVANCED_QUESTIONS = ["difficulty", "rollMode", "concentration"];

export function openRecommendationOptionsModal({
  modalApi,
  groups,
  answers,
  title = "Recommendation Options",
  includeSituationNotes = false,
  initialNotes = "",
  onApply
}) {
  const body = document.createElement("form");
  body.className = "recommendation-options-form";
  body.innerHTML = renderForm({ groups, answers, includeSituationNotes, initialNotes });

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

export function renderRecommendationOptionsControls(groups, answers) {
  const questions = getRecommendationQuestionConfig(groups, answers);
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

function renderForm({ groups, answers, includeSituationNotes, initialNotes }) {
  return `
    ${renderRecommendationOptionsControls(groups, answers)}
    ${includeSituationNotes ? `
      <label class="field ai-notes-field">
        <span class="field-label">Describe the situation</span>
        <textarea data-ai-notes placeholder="Enemy position, defenses, ally danger, objective, hazards, or table rulings.">${escapeHtml(initialNotes)}</textarea>
      </label>
    ` : ""}
  `;
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

import {
  getDefaultRecommendationAnswers,
  getRecommendationQuestionConfig
} from "../recommendations/recommendationScoring.js";
import { escapeHtml } from "./renderUtils.js";

let recommendationAnswers = getDefaultRecommendationAnswers();

export function getRecommendationAnswers() {
  return { ...recommendationAnswers };
}

export function updateRecommendationAnswer(key, value) {
  recommendationAnswers = {
    ...recommendationAnswers,
    [key]: value
  };
}

export function resetRecommendationAnswers() {
  recommendationAnswers = getDefaultRecommendationAnswers();
}

export function renderRecommendationWizardPanel(groups, rankedEntries) {
  const questions = getRecommendationQuestionConfig(groups, recommendationAnswers);
  const top = rankedEntries.slice(0, 3);
  return `
    <section class="recommendation-wizard" aria-label="Recommendation wizard">
      <div class="recommendation-wizard__header">
        <div>
          <span class="section-label">Recommendation Wizard</span>
          <p>Answer the tactical prompts to rank available options.</p>
        </div>
        <button class="btn btn-secondary" type="button" data-recommendation-reset>Reset</button>
      </div>
      <div class="recommendation-questions">
        ${questions.map(renderQuestion).join("")}
      </div>
      ${top.length ? `
        <div class="recommendation-topline" aria-label="Top recommendations">
          ${top.map((entry) => `
            <span class="recommendation-top-chip">
              <strong>#${entry.rank}</strong>
              ${escapeHtml(entry.option.name)}
            </span>
          `).join("")}
        </div>
      ` : ""}
    </section>
  `;
}

export function bindRecommendationWizardEvents(root, onChange) {
  root.querySelectorAll("[data-recommendation-answer]").forEach((button) => {
    button.addEventListener("click", () => {
      updateRecommendationAnswer(button.dataset.recommendationAnswer, button.dataset.recommendationValue);
      onChange();
    });
  });

  root.querySelector("[data-recommendation-reset]")?.addEventListener("click", () => {
    resetRecommendationAnswers();
    onChange();
  });
}

function renderQuestion(question) {
  return `
    <fieldset class="recommendation-question">
      <legend>${escapeHtml(question.label)}</legend>
      <div class="recommendation-choice-group">
        ${question.options.map(([value, label]) => `
          <button
            class="recommendation-choice ${question.value === value ? "is-selected" : ""}"
            type="button"
            data-recommendation-answer="${escapeHtml(question.id)}"
            data-recommendation-value="${escapeHtml(value)}"
            aria-pressed="${question.value === value ? "true" : "false"}">
            ${escapeHtml(label)}
          </button>
        `).join("")}
      </div>
    </fieldset>
  `;
}

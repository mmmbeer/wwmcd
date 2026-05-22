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
  return `
    <section class="recommendation-wizard" aria-label="Recommendation wizard">
      <div class="recommendation-wizard__header">
        <span class="section-label">Recommendation Wizard</span>
        <button class="btn btn-secondary recommendation-reset" type="button" data-recommendation-reset>Reset</button>
      </div>
      <div class="recommendation-questions" aria-label="Recommendation filters">
        ${questions.map(renderQuestion).join("")}
      </div>
    </section>
  `;
}

export function bindRecommendationWizardEvents(root, onChange) {
  root.querySelectorAll("[data-recommendation-answer]").forEach((select) => {
    select.addEventListener("change", () => {
      updateRecommendationAnswer(select.dataset.recommendationAnswer, select.value);
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

export function renderRecommendationSets(sets) {
  const cards = sets.length
    ? sets.map(renderRecommendationSet).join("")
    : `<p class="inline-message">No compatible recommendation sets are available right now.</p>`;
  return `
    <section class="recommendation-sets action-list-shell" aria-label="Recommended turn sets">
      <div class="action-list-toolbar">
        <span class="section-label">Recommended Turn Sets</span>
      </div>
      <div class="recommendation-set-list">
        ${cards}
      </div>
    </section>
  `;
}

function renderRecommendationSet(set) {
  return `
    <article class="recommendation-set-card">
      <div class="recommendation-set-card__head">
        <span class="recommendation-rank">#${escapeHtml(set.rank)}</span>
        <div>
          <strong>${escapeHtml(set.title)}</strong>
          <small>${escapeHtml(set.score)} pts</small>
        </div>
      </div>
      <div class="recommendation-set-pieces">
        ${set.pieces.map(renderSetPiece).join("")}
      </div>
      ${renderSetDetails(set)}
      ${set.reasons.length ? `
        <div class="recommendation-set-reasons">
          ${set.reasons.map((reason) => `<span class="recommendation-reason">${escapeHtml(reason)}</span>`).join("")}
        </div>
      ` : ""}
      ${set.warnings.length ? `<p class="inline-message warning">${escapeHtml(set.warnings.join(" "))}</p>` : ""}
    </article>
  `;
}

function renderSetDetails(set) {
  const details = set.pieces
    .map((piece) => ({ piece, text: descriptionText(piece.entry.option) }))
    .filter(({ text }) => text);
  if (!details.length) return "";
  return `
    <div class="recommendation-set-details">
      ${details.map(({ piece, text }) => `
        <details>
          <summary>${escapeHtml(piece.slot)}: ${escapeHtml(piece.entry.option.name)}</summary>
          <p>${escapeHtml(text)}</p>
        </details>
      `).join("")}
    </div>
  `;
}

function renderSetPiece(piece) {
  const option = piece.entry.option;
  return `
    <button class="recommendation-set-piece" type="button" data-plan-option="${escapeHtml(option.id)}">
      <span>${escapeHtml(piece.slot)}</span>
      <strong>${escapeHtml(option.name)}</strong>
    </button>
  `;
}

function descriptionText(option) {
  return option.longDescription
    ?? option.spell?.reference?.description
    ?? option.featureAction?.description
    ?? option.description
    ?? "";
}

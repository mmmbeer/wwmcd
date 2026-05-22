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

export function renderRecommendationWizardPanel(groups, rankedEntries, { aiEnabled = false } = {}) {
  const questions = getRecommendationQuestionConfig(groups, recommendationAnswers);
  return `
    <section class="recommendation-wizard" aria-label="Recommendation wizard">
      <div class="recommendation-wizard__header">
        <span class="section-label">Recommendation Wizard</span>
        <div class="recommendation-wizard__actions">
          ${aiEnabled ? `<button class="btn btn-secondary recommendation-ai-button" type="button" data-recommendation-ai aria-label="Open AI recommendations">AI</button>` : ""}
          <button class="btn btn-secondary recommendation-reset" type="button" data-recommendation-reset>Reset</button>
        </div>
      </div>
      <div class="recommendation-questions" aria-label="Recommendation filters">
        ${questions.map(renderQuestion).join("")}
      </div>
    </section>
  `;
}

export function bindRecommendationWizardEvents(root, onChange, { onAiClick } = {}) {
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

  root.querySelector("[data-recommendation-ai]")?.addEventListener("click", () => onAiClick?.());
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

export function renderAiRecommendationSets(sets) {
  const cards = sets.length
    ? sets.map(renderAiRecommendationSet).join("")
    : `<p class="inline-message">No AI recommendation sets are available right now.</p>`;
  return `
    <section class="recommendation-sets action-list-shell ai-recommendation-results" aria-label="AI recommended turn sets">
      <div class="action-list-toolbar">
        <span class="section-label">AI Recommended Turn Sets</span>
        <span class="ai-recommendation-badge">AI Recommendation</span>
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

function renderAiRecommendationSet(set) {
  return `
    <article class="recommendation-set-card ai-recommendation-card">
      <div class="recommendation-set-card__head">
        <span class="recommendation-rank">#${escapeHtml(set.rank)}</span>
        <div>
          <strong>${escapeHtml(set.title)}</strong>
          <small>AI recommendation${set.score ? ` - ${escapeHtml(set.score)} pts` : ""}</small>
        </div>
        <span class="ai-recommendation-badge">AI</span>
      </div>
      ${set.summary ? `<p class="ai-recommendation-summary">${escapeHtml(set.summary)}</p>` : ""}
      <div class="recommendation-set-pieces">
        ${set.pieces.map(renderAiSetPiece).join("")}
      </div>
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

function renderAiSetPiece(piece) {
  const canPlan = Boolean(piece.optionId);
  return `
    <button class="recommendation-set-piece ai-recommendation-piece" type="button" ${canPlan ? `data-plan-option="${escapeHtml(piece.optionId)}"` : "disabled"}>
      <span>${escapeHtml(piece.slot)} - AI</span>
      <strong>${escapeHtml(piece.name)}</strong>
      ${piece.explanation ? `<small>${escapeHtml(piece.explanation)}</small>` : ""}
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

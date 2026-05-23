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

export function setRecommendationAnswers(answers = {}) {
  recommendationAnswers = {
    ...getDefaultRecommendationAnswers(),
    ...answers
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
          <button class="btn btn-primary recommendation-help-button" type="button" data-recommendation-help>Help Me!</button>
          ${aiEnabled ? `<button class="btn btn-secondary recommendation-ai-button" type="button" data-recommendation-ai>Use AI!</button>` : ""}
          <button class="btn btn-secondary recommendation-reset" type="button" data-recommendation-reset>Reset</button>
        </div>
      </div>
      <div class="recommendation-summary" aria-label="Current recommendation filters">
        ${questions.map(renderSummaryItem).join("")}
      </div>
    </section>
  `;
}

export function bindRecommendationWizardEvents(root, onChange, { onHelpClick, onAiClick } = {}) {
  root.querySelector("[data-recommendation-help]")?.addEventListener("click", () => onHelpClick?.());
  root.querySelector("[data-recommendation-reset]")?.addEventListener("click", () => {
    resetRecommendationAnswers();
    onChange();
  });

  root.querySelector("[data-recommendation-ai]")?.addEventListener("click", () => onAiClick?.());
}

function renderSummaryItem(question) {
  const selected = question.options.find(([value]) => value === question.value);
  return `
    <span class="recommendation-reason">
      ${escapeHtml(question.label)}: ${escapeHtml(selected?.[1] ?? question.value ?? "Any")}
    </span>
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

export function renderAiRecommendationSets(result) {
  const sets = result?.recommendations ?? result?.sets ?? result ?? [];
  const cards = sets.length
    ? sets.map(renderAiRecommendationSet).join("")
    : `<p class="inline-message">No AI recommendations are available right now.</p>`;
  return `
    <section class="recommendation-sets action-list-shell ai-recommendation-results" aria-label="AI recommended actions">
      <div class="action-list-toolbar">
        <span class="section-label">AI Recommended Actions</span>
        <span class="ai-recommendation-badge">AI Recommendation</span>
      </div>
      ${result?.guidance ? `<p class="ai-recommendation-summary">${escapeHtml(result.guidance)}</p>` : ""}
      ${result?.turnAssessment ? `<p class="ai-recommendation-summary">${escapeHtml(result.turnAssessment)}</p>` : ""}
      ${result?.missingInfo?.length ? `<p class="inline-message warning">Missing info: ${escapeHtml(result.missingInfo.join(", "))}</p>` : ""}
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
          <small>${escapeHtml(set.category ?? "other")} - ${escapeHtml(set.legality ?? "conditional")}${set.score ? ` - ${escapeHtml(set.score)} pts` : ""}</small>
        </div>
        <span class="ai-recommendation-badge">AI</span>
      </div>
      ${set.summary ? `<p class="ai-recommendation-summary">${escapeHtml(set.summary)}</p>` : ""}
      ${renderAiPlanDetails(set)}
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

function renderAiPlanDetails(set) {
  const rows = [
    ["Resources", set.resourcesUsed?.join(", ")],
    ["Concentration", set.concentrationImpact],
    ["Outcome", set.expectedOutcome]
  ].filter(([, value]) => value);
  if (!rows.length) return "";
  return `
    <div class="recommendation-set-details">
      ${rows.map(([label, value]) => `
        <p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>
      `).join("")}
    </div>
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
      <span>AI Option</span>
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

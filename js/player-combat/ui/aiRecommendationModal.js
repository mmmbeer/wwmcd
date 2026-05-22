import { buildAiRecommendationContext } from "../ai/aiRecommendationContext.js";
import { getAiSettings } from "../ai/aiSettings.js";
import { getAiRecommendations } from "../ai/aiRecommendationService.js";
import { escapeHtml } from "./renderUtils.js";

export function openAiRecommendationModal({
  modalApi,
  storage,
  snapshot,
  groups,
  recommendationSets,
  answers,
  showToast,
  openSettings,
  onPlanOption
}) {
  const body = document.createElement("div");
  body.className = "ai-recommendation-modal";
  body.innerHTML = renderInitialBody({ settings: getAiSettings(storage), answers });
  bindEvents(body, { storage, snapshot, groups, recommendationSets, answers, showToast, openSettings, onPlanOption });
  modalApi.showModal({
    title: "AI Recommendations",
    body,
    actions: [{ label: "Close", variant: "secondary" }]
  });
}

function renderInitialBody({ settings, answers }) {
  const ready = Boolean(settings.groqApiKey && settings.groqModel);
  return `
    <div class="ai-context-summary">
      ${summaryItem("Goal", answers.goal)}
      ${summaryItem("Situation", answers.situation)}
      ${summaryItem("Range", answers.distance)}
      ${summaryItem("DC", answers.difficulty)}
      ${summaryItem("Resources", answers.resources)}
      ${summaryItem("Rolls", answers.rollMode)}
      ${summaryItem("Concentration", answers.concentration)}
    </div>
    ${ready ? "" : `
      <p class="inline-message warning">Save a Groq API key and select a model in AI Options before requesting recommendations.</p>
      <button class="btn btn-primary" type="button" data-ai-open-settings>Open AI Options</button>
    `}
    <label class="field ai-notes-field">
      <span class="field-label">What else matters right now?</span>
      <textarea data-ai-notes placeholder="Enemy resistances, ally danger, battlefield hazards, monster AC, expected saves, positioning, objectives, or table rulings."></textarea>
    </label>
    <button class="btn btn-primary" type="button" data-ai-get-recommendations ${ready ? "" : "disabled"}>Get Recommendations</button>
    <div class="ai-loading" data-ai-loading hidden>
      <span class="busy-spinner" aria-hidden="true"></span>
      <strong>Getting recommendations...</strong>
    </div>
    <div data-ai-results></div>
  `;
}

function bindEvents(body, services) {
  body.querySelector("[data-ai-open-settings]")?.addEventListener("click", () => services.openSettings?.());
  body.querySelector("[data-ai-get-recommendations]")?.addEventListener("click", () => requestRecommendations(body, services));
  body.addEventListener("click", (event) => {
    const button = event.target.closest("[data-ai-plan-option]");
    if (!button) return;
    services.onPlanOption?.(button.dataset.aiPlanOption);
  });
}

async function requestRecommendations(body, { storage, snapshot, groups, recommendationSets, answers, showToast }) {
  const settings = getAiSettings(storage);
  const button = body.querySelector("[data-ai-get-recommendations]");
  const loading = body.querySelector("[data-ai-loading]");
  const results = body.querySelector("[data-ai-results]");
  const notes = body.querySelector("[data-ai-notes]")?.value ?? "";

  setBusy({ button, loading, busy: true });
  results.innerHTML = "";

  try {
    const context = buildAiRecommendationContext({ snapshot, groups, recommendationSets, answers, userNotes: notes });
    const recommendations = await getAiRecommendations({
      apiKey: settings.groqApiKey,
      model: settings.groqModel,
      context
    });
    results.innerHTML = renderAiRecommendationSets(recommendations);
  } catch (error) {
    results.innerHTML = `<p class="inline-message error">${escapeHtml(error.message)}</p>`;
    showToast?.({ type: "error", message: error.message });
  } finally {
    setBusy({ button, loading, busy: false });
  }
}

function renderAiRecommendationSets(sets) {
  if (!sets.length) return `<p class="inline-message">AI did not return any recommendation sets.</p>`;
  return `
    <section class="recommendation-sets ai-recommendation-results" aria-label="AI recommended turn sets">
      <div class="action-list-toolbar">
        <span class="section-label">AI Ranked Turn Sets</span>
      </div>
      <div class="recommendation-set-list">
        ${sets.map(renderAiSet).join("")}
      </div>
    </section>
  `;
}

function renderAiSet(set) {
  return `
    <article class="recommendation-set-card">
      <div class="recommendation-set-card__head">
        <span class="recommendation-rank">#${escapeHtml(set.rank)}</span>
        <div>
          <strong>${escapeHtml(set.title)}</strong>
          <small>${escapeHtml(set.score)} pts</small>
        </div>
      </div>
      ${set.summary ? `<p class="ai-recommendation-summary">${escapeHtml(set.summary)}</p>` : ""}
      <div class="recommendation-set-pieces">
        ${set.pieces.map(renderAiPiece).join("")}
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

function renderAiPiece(piece) {
  const canPlan = Boolean(piece.optionId);
  return `
    <button class="recommendation-set-piece" type="button" ${canPlan ? `data-ai-plan-option="${escapeHtml(piece.optionId)}"` : "disabled"}>
      <span>${escapeHtml(piece.slot)}</span>
      <strong>${escapeHtml(piece.name)}</strong>
      ${piece.explanation ? `<small>${escapeHtml(piece.explanation)}</small>` : ""}
    </button>
  `;
}

function summaryItem(label, value) {
  return `
    <span class="recommendation-reason">
      ${escapeHtml(label)}: ${escapeHtml(value ?? "Any")}
    </span>
  `;
}

function setBusy({ button, loading, busy }) {
  if (button) button.disabled = busy;
  if (loading) loading.hidden = !busy;
}

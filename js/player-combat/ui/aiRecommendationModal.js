import { buildAiRecommendationContext } from "../ai/aiRecommendationContext.js";
import { getActiveAiProviderSettings, getAiSettings } from "../ai/aiSettings.js";
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
  onRecommendations
}) {
  const body = document.createElement("div");
  body.className = "ai-recommendation-modal";
  body.innerHTML = renderInitialBody({ settings: getAiSettings(storage), answers });
  bindEvents(body, { modalApi, storage, snapshot, groups, recommendationSets, answers, showToast, openSettings, onRecommendations });
  modalApi.showModal({
    title: "AI Recommendations",
    body,
    actions: [{ label: "Close", variant: "secondary" }]
  });
}

function renderInitialBody({ settings, answers }) {
  const active = getActiveAiProviderSettings(settings);
  const ready = Boolean(active.apiKey && active.model);
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
      <p class="inline-message warning">Save a provider API key and select a model in AI Options before requesting recommendations.</p>
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
    <div data-ai-status></div>
  `;
}

function bindEvents(body, services) {
  body.querySelector("[data-ai-open-settings]")?.addEventListener("click", () => services.openSettings?.());
  body.querySelector("[data-ai-get-recommendations]")?.addEventListener("click", () => requestRecommendations(body, services));
}

async function requestRecommendations(body, { modalApi, storage, snapshot, groups, recommendationSets, answers, showToast, onRecommendations }) {
  const settings = getAiSettings(storage);
  const active = getActiveAiProviderSettings(settings);
  const button = body.querySelector("[data-ai-get-recommendations]");
  const loading = body.querySelector("[data-ai-loading]");
  const status = body.querySelector("[data-ai-status]");
  const notes = body.querySelector("[data-ai-notes]")?.value ?? "";

  setBusy({ button, loading, busy: true });
  status.innerHTML = "";

  try {
    const context = buildAiRecommendationContext({ snapshot, groups, recommendationSets, answers, userNotes: notes });
    const recommendations = await getAiRecommendations({
      provider: active.provider,
      apiKey: active.apiKey,
      model: active.model,
      context
    });
    onRecommendations?.(recommendations);
    modalApi.close();
    showToast?.({ type: "success", message: "AI recommendations updated." });
  } catch (error) {
    status.innerHTML = `<p class="inline-message error">${escapeHtml(error.message)}</p>`;
    showToast?.({ type: "error", message: error.message });
  } finally {
    setBusy({ button, loading, busy: false });
  }
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

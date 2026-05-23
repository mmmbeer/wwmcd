import { buildAiRecommendationContext } from "../ai/aiRecommendationContext.js";
import { getActiveAiProviderSettings, getAiSettings } from "../ai/aiSettings.js";
import { getAiRecommendations } from "../ai/aiRecommendationService.js";
import {
  readRecommendationOptionsForm,
  renderRecommendationOptionsControls
} from "./recommendationOptionsModal.js";
import { escapeHtml } from "./renderUtils.js";

let savedAiNotes = "";

export function openAiRecommendationModal({
  modalApi,
  storage,
  snapshot,
  groups,
  recommendationSets,
  answers,
  showToast,
  openSettings,
  onAnswersChanged,
  onRecommendations
}) {
  const body = document.createElement("div");
  body.className = "ai-recommendation-modal";
  body.innerHTML = renderInitialBody({ settings: getAiSettings(storage), groups, answers, notes: savedAiNotes });
  bindEvents(body, { modalApi, storage, snapshot, groups, recommendationSets, answers, showToast, openSettings, onAnswersChanged, onRecommendations });
  modalApi.showModal({
    title: "AI Recommendations",
    body,
    actions: [{ label: "Close", variant: "secondary" }]
  });
}

function renderInitialBody({ settings, groups, answers, notes }) {
  const active = getActiveAiProviderSettings(settings);
  const ready = Boolean(active.apiKey && active.model);
  return `
    ${renderRecommendationOptionsControls(groups, answers)}
    ${ready ? "" : `
      <p class="inline-message warning">Save a provider API key and select a model in AI Options before requesting recommendations.</p>
      <button class="btn btn-primary" type="button" data-ai-open-settings>Open AI Options</button>
    `}
    <label class="field ai-notes-field">
      <span class="field-label">What else matters right now?</span>
      <textarea data-ai-notes placeholder="Enemy resistances, ally danger, battlefield hazards, monster AC, expected saves, positioning, objectives, or table rulings.">${escapeHtml(notes)}</textarea>
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
  body.querySelector("[data-ai-notes]")?.addEventListener("input", (event) => {
    savedAiNotes = event.currentTarget.value;
  });
  body.querySelector("[data-ai-get-recommendations]")?.addEventListener("click", () => requestRecommendations(body, services));
}

async function requestRecommendations(body, { modalApi, storage, snapshot, groups, recommendationSets, answers, showToast, onAnswersChanged, onRecommendations }) {
  const settings = getAiSettings(storage);
  const active = getActiveAiProviderSettings(settings);
  const button = body.querySelector("[data-ai-get-recommendations]");
  const loading = body.querySelector("[data-ai-loading]");
  const status = body.querySelector("[data-ai-status]");
  const notes = body.querySelector("[data-ai-notes]")?.value ?? "";
  savedAiNotes = notes;
  const nextAnswers = {
    ...answers,
    ...readRecommendationOptionsForm(body)
  };

  setBusy({ button, loading, busy: true });
  status.innerHTML = "";

  try {
    onAnswersChanged?.(nextAnswers);
    const context = buildAiRecommendationContext({ snapshot, groups, recommendationSets, answers: nextAnswers, userNotes: notes });
    const recommendations = await getAiRecommendations({
      provider: active.provider,
      apiKey: active.apiKey,
      model: active.model,
      context
    });
    onRecommendations?.(recommendations);
    body.innerHTML = renderAiGuidance(recommendations);
    body.querySelector("[data-ai-return]")?.addEventListener("click", () => modalApi.close());
    showToast?.({ type: "success", message: "AI recommendation list updated." });
  } catch (error) {
    status.innerHTML = `<p class="inline-message error">${escapeHtml(error.message)}</p>`;
    showToast?.({ type: "error", message: error.message });
  } finally {
    setBusy({ button, loading, busy: false });
  }
}

function renderAiGuidance(result) {
  const guidance = [
    result?.guidance,
    result?.turnAssessment
  ].filter(Boolean).join(" ");
  const missing = result?.missingInfo?.length
    ? `<p class="inline-message warning">Missing info: ${escapeHtml(result.missingInfo.join(", "))}</p>`
    : "";
  return `
    <div class="ai-guidance-panel">
      <span class="section-label">AI Guidance</span>
      ${guidance ? `<p>${escapeHtml(guidance)}</p>` : `<p>AI recommendations are ready.</p>`}
      ${missing}
      <button class="btn btn-primary" type="button" data-ai-return>Return to Recommended Actions</button>
    </div>
  `;
}

function setBusy({ button, loading, busy }) {
  if (button) button.disabled = busy;
  if (loading) loading.hidden = !busy;
}

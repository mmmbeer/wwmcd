import { buildAiRecommendationContext } from "../ai/aiRecommendationContext.js";
import {
  findBestiaryOptionByName,
  getBestiaryOptions
} from "../data/bestiaryOptions.js";
import { getActiveAiProviderSettings, getAiSettings } from "../ai/aiSettings.js";
import { getAiRecommendations } from "../ai/aiRecommendationService.js";
import { buildClarificationContext } from "../ai/aiClarificationContext.js";
import {
  readRecommendationOptionsForm,
  renderRecommendationOptionsControls
} from "./recommendationOptionsModal.js";
import { escapeHtml } from "./renderUtils.js";

let savedAiNotes = "";
let savedCreatureOption = null;

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
  const creatureOptions = getBestiaryOptions(snapshot.referenceData);
  body.innerHTML = renderInitialBody({
    settings: getAiSettings(storage),
    snapshot,
    groups,
    answers,
    notes: savedAiNotes,
    creatureOptions,
    selectedCreature: savedCreatureOption
  });
  bindEvents(body, { modalApi, storage, snapshot, groups, recommendationSets, answers, showToast, openSettings, onAnswersChanged, onRecommendations, creatureOptions });
  modalApi.showModal({
    title: "AI Recommendations",
    body,
    actions: [{ label: "Close", variant: "secondary" }]
  });
}

function renderInitialBody({ settings, snapshot, groups, answers, notes, creatureOptions, selectedCreature }) {
  const active = getActiveAiProviderSettings(settings);
  const ready = Boolean(active.apiKey && active.model);
  return `
    ${renderRecommendationOptionsControls(groups, answers, {
      character: snapshot.activeCharacter,
      combatState: snapshot.combatState
    })}
    ${ready ? "" : `
      <p class="inline-message warning">Save a provider API key and select a model in AI Options before requesting recommendations.</p>
      <button class="btn btn-primary" type="button" data-ai-open-settings>Open AI Options</button>
    `}
    ${renderCreatureSelector(creatureOptions, selectedCreature)}
    ${renderQuickClarifications({ answers, notes, selectedCreature, snapshot })}
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

export function renderCreatureSelector(creatureOptions = [], selectedCreature = null) {
  const disabled = creatureOptions.length ? "" : "disabled";
  const value = selectedCreature?.name ?? "";
  return `
    <div class="field ai-creature-field">
      <label class="field-label" for="ai-creature-combobox">Creature</label>
      <input
        id="ai-creature-combobox"
        class="field-input"
        type="text"
        list="ai-creature-options"
        data-ai-creature-input
        value="${escapeHtml(value)}"
        placeholder="${creatureOptions.length ? "Type to find a creature" : "Bestiary unavailable"}"
        autocomplete="off"
        ${disabled}
      >
      <datalist id="ai-creature-options">
        ${creatureOptions.map((option) => `<option value="${escapeHtml(option.name)}"></option>`).join("")}
      </datalist>
      <div class="ai-creature-badges" data-ai-creature-badges>
        ${renderSelectedCreatureBadge(selectedCreature)}
      </div>
    </div>
  `;
}

function renderSelectedCreatureBadge(selectedCreature) {
  if (!selectedCreature) return "";
  return `
    <span class="ai-creature-badge">
      <span>${escapeHtml(selectedCreature.name)}</span>
      <button type="button" aria-label="Remove ${escapeHtml(selectedCreature.name)}" data-ai-remove-creature>&times;</button>
    </span>
  `;
}

function bindEvents(body, services) {
  body.querySelector("[data-ai-open-settings]")?.addEventListener("click", () => services.openSettings?.());
  body.querySelector("[data-ai-notes]")?.addEventListener("input", (event) => {
    savedAiNotes = event.currentTarget.value;
  });
  body.querySelector("[data-ai-creature-input]")?.addEventListener("change", (event) => {
    const match = findBestiaryOptionByName(services.creatureOptions, event.currentTarget.value);
    savedCreatureOption = match;
    if (match) event.currentTarget.value = match.name;
    renderCreatureBadges(body);
  });
  body.querySelector("[data-ai-remove-creature]")?.addEventListener("click", () => removeSelectedCreature(body));
  body.querySelector("[data-ai-clarification-prompts]")?.addEventListener("click", (event) => {
    const prompt = event.target.closest("[data-ai-clarification]");
    if (!prompt) return;
    appendClarificationPrompt(body, prompt.dataset.aiClarification);
  });
  body.querySelector("[data-ai-creature-badges]")?.addEventListener("click", (event) => {
    if (event.target.closest("[data-ai-remove-creature]")) removeSelectedCreature(body);
  });
  body.querySelector("[data-ai-get-recommendations]")?.addEventListener("click", () => requestRecommendations(body, services));
}

function renderQuickClarifications({ answers, notes, selectedCreature, snapshot }) {
  const context = buildClarificationContext({
    answers,
    userNotes: notes,
    combatState: snapshot.combatState,
    selectedCreatures: selectedCreature ? [selectedCreature.creature] : []
  });
  if (!context.prompts?.length) return "";
  return `
    <div class="ai-clarification-prompts" data-ai-clarification-prompts>
      <span class="field-label">Useful details</span>
      <div class="recommendation-summary">
        ${context.prompts.map((prompt) => `
          <button class="btn btn-secondary" type="button" data-ai-clarification="${escapeHtml(prompt.noteTemplate)}">
            ${escapeHtml(prompt.question)}
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

function appendClarificationPrompt(body, template) {
  const notes = body.querySelector("[data-ai-notes]");
  if (!notes || !template) return;
  const current = notes.value.trim();
  notes.value = current ? `${current}\n${template}` : template;
  savedAiNotes = notes.value;
  notes.focus();
}

function removeSelectedCreature(body) {
  savedCreatureOption = null;
  const input = body.querySelector("[data-ai-creature-input]");
  if (input) input.value = "";
  renderCreatureBadges(body);
}

function renderCreatureBadges(body) {
  const badges = body.querySelector("[data-ai-creature-badges]");
  if (badges) badges.innerHTML = renderSelectedCreatureBadge(savedCreatureOption);
}

async function requestRecommendations(body, { modalApi, storage, snapshot, groups, recommendationSets, answers, showToast, onAnswersChanged, onRecommendations }) {
  if (body.dataset.aiRequestInFlight === "true") return;
  body.dataset.aiRequestInFlight = "true";
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
    const context = buildAiRecommendationContext({
      snapshot,
      groups,
      recommendationSets,
      answers: nextAnswers,
      userNotes: notes,
      selectedCreatures: savedCreatureOption ? [savedCreatureOption.creature] : []
    });
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
    delete body.dataset.aiRequestInFlight;
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

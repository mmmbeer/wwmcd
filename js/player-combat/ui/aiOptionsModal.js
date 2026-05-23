import { fetchAiModels } from "../ai/aiClient.js";
import {
  AI_PROVIDERS,
  getActiveAiProviderSettings,
  getAiProviderLabel,
  getAiSettings,
  maskApiKey,
  saveAiProviderSettings,
  saveAiSettings
} from "../ai/aiSettings.js";
import { escapeHtml } from "./renderUtils.js";

export function openAiOptionsModal({ modalApi, storage, showToast, onSettingsChanged }) {
  const settings = getAiSettings(storage);
  const body = document.createElement("div");
  body.className = "ai-options-form";
  body.innerHTML = renderBody(settings);
  bindEvents(body, { storage, showToast, onSettingsChanged });

  modalApi.showModal({
    title: "AI Options",
    body,
    actions: [{ label: "Close", variant: "secondary" }]
  });
}

function renderBody(settings) {
  const active = getActiveAiProviderSettings(settings);
  const models = active.models ?? [];
  return `
    <p class="inline-message">Your provider-specific API key is saved only in this browser's local storage and sent to the local PHP proxy when AI requests are made.</p>
    <label class="form-field">
      <span class="field-label">AI Provider</span>
      <select data-ai-provider>
        ${AI_PROVIDERS.map((provider) => `
          <option value="${escapeHtml(provider.id)}" ${provider.id === settings.provider ? "selected" : ""}>${escapeHtml(provider.label)}</option>
        `).join("")}
      </select>
    </label>
    <label class="form-field">
      <span class="field-label">AI API Key</span>
      <input type="password" autocomplete="off" data-ai-api-key placeholder="${escapeHtml(maskApiKey(active.apiKey))}">
    </label>
    <div class="ai-options-actions">
      <button class="btn btn-primary" type="button" data-ai-save-key>Save Key</button>
      <button class="btn btn-secondary" type="button" data-ai-fetch-models ${active.apiKey ? "" : "disabled"}>Load Models</button>
    </div>
    <label class="form-field">
      <span class="field-label">AI Model</span>
      <select data-ai-model ${models.length ? "" : "disabled"}>
        ${models.length ? models.map((model) => `
          <option value="${escapeHtml(model.id)}" ${model.id === active.model ? "selected" : ""}>${escapeHtml(model.id)}</option>
        `).join("") : `<option value="">Save a key and load models</option>`}
      </select>
    </label>
    <p class="inline-message" data-ai-options-status>${active.model ? `Selected ${escapeHtml(active.label)} model: ${escapeHtml(active.model)}` : "No AI model selected yet."}</p>
  `;
}

function bindEvents(body, { storage, showToast, onSettingsChanged }) {
  const status = body.querySelector("[data-ai-options-status]");
  const providerSelect = body.querySelector("[data-ai-provider]");
  const saveButton = body.querySelector("[data-ai-save-key]");
  const fetchButton = body.querySelector("[data-ai-fetch-models]");
  const modelSelect = body.querySelector("[data-ai-model]");

  providerSelect?.addEventListener("change", () => {
    saveAiSettings(storage, { provider: providerSelect.value });
    const settings = getAiSettings(storage);
    const active = getActiveAiProviderSettings(settings);
    const input = body.querySelector("[data-ai-api-key]");
    if (input) {
      input.value = "";
      input.placeholder = maskApiKey(active.apiKey);
    }
    fetchButton.disabled = !active.apiKey;
    renderModelOptions(modelSelect, active.models, active.model);
    status.textContent = active.model ? `Selected ${active.label} model: ${active.model}` : "No AI model selected yet.";
    onSettingsChanged?.();
  });

  saveButton?.addEventListener("click", () => {
    const provider = providerSelect?.value ?? "groq";
    const label = getAiProviderLabel(provider);
    const input = body.querySelector("[data-ai-api-key]");
    const value = input.value.trim();
    if (!value) {
      showToast?.({ type: "warning", message: `Enter a ${label} API key before saving.` });
      return;
    }
    saveAiProviderSettings(storage, provider, { apiKey: value, model: "", models: [] });
    input.value = "";
    input.placeholder = maskApiKey(value);
    fetchButton.disabled = false;
    renderModelOptions(modelSelect, [], "");
    status.textContent = "API key saved locally. Load models to choose one.";
    showToast?.({ type: "success", message: `${label} API key saved locally.` });
    onSettingsChanged?.();
  });

  fetchButton?.addEventListener("click", async () => {
    const settings = getAiSettings(storage);
    const active = getActiveAiProviderSettings(settings);
    if (!active.apiKey) return;
    setLoading(fetchButton, true);
    try {
      const models = await fetchAiModels({ provider: active.provider, apiKey: active.apiKey });
      const selected = models.find((model) => model.id === active.model)?.id ?? models[0]?.id ?? "";
      saveAiProviderSettings(storage, active.provider, { models, model: selected, modelsFetchedAt: new Date().toISOString() });
      renderModelOptions(modelSelect, models, selected);
      status.textContent = selected ? `Selected ${active.label} model: ${selected}` : `No ${active.label} chat models were returned.`;
      showToast?.({ type: "success", message: `${active.label} models loaded.` });
      onSettingsChanged?.();
    } catch (error) {
      status.textContent = error.message;
      showToast?.({ type: "error", message: error.message });
    } finally {
      setLoading(fetchButton, false);
    }
  });

  modelSelect?.addEventListener("change", () => {
    const provider = providerSelect?.value ?? "groq";
    saveAiProviderSettings(storage, provider, { model: modelSelect.value });
    status.textContent = modelSelect.value ? `Selected ${getAiProviderLabel(provider)} model: ${modelSelect.value}` : "No AI model selected yet.";
    onSettingsChanged?.();
  });
}

function renderModelOptions(select, models, selected) {
  if (!select) return;
  select.disabled = !models.length;
  select.innerHTML = models.length
    ? models.map((model) => `<option value="${escapeHtml(model.id)}" ${model.id === selected ? "selected" : ""}>${escapeHtml(model.id)}</option>`).join("")
    : `<option value="">No models available</option>`;
}

function setLoading(button, loading) {
  if (!button) return;
  button.disabled = loading;
  button.textContent = loading ? "Loading..." : "Load Models";
}

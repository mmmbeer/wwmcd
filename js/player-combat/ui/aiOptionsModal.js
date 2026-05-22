import { fetchGroqModels } from "../ai/groqClient.js";
import { getAiSettings, maskApiKey, saveAiSettings } from "../ai/aiSettings.js";
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
  const models = settings.groqModels ?? [];
  return `
    <p class="inline-message">Your Groq API key is saved only in this browser's local storage and sent to the local PHP proxy when AI requests are made.</p>
    <label class="form-field">
      <span class="field-label">Groq API Key</span>
      <input type="password" autocomplete="off" data-ai-api-key placeholder="${escapeHtml(maskApiKey(settings.groqApiKey))}">
    </label>
    <div class="ai-options-actions">
      <button class="btn btn-primary" type="button" data-ai-save-key>Save Key</button>
      <button class="btn btn-secondary" type="button" data-ai-fetch-models ${settings.groqApiKey ? "" : "disabled"}>Load Models</button>
    </div>
    <label class="form-field">
      <span class="field-label">Groq Model</span>
      <select data-ai-model ${models.length ? "" : "disabled"}>
        ${models.length ? models.map((model) => `
          <option value="${escapeHtml(model.id)}" ${model.id === settings.groqModel ? "selected" : ""}>${escapeHtml(model.id)}</option>
        `).join("") : `<option value="">Save a key and load models</option>`}
      </select>
    </label>
    <p class="inline-message" data-ai-options-status>${settings.groqModel ? `Selected model: ${escapeHtml(settings.groqModel)}` : "No AI model selected yet."}</p>
  `;
}

function bindEvents(body, { storage, showToast, onSettingsChanged }) {
  const status = body.querySelector("[data-ai-options-status]");
  const saveButton = body.querySelector("[data-ai-save-key]");
  const fetchButton = body.querySelector("[data-ai-fetch-models]");
  const modelSelect = body.querySelector("[data-ai-model]");

  saveButton?.addEventListener("click", () => {
    const input = body.querySelector("[data-ai-api-key]");
    const value = input.value.trim();
    if (!value) {
      showToast?.({ type: "warning", message: "Enter a Groq API key before saving." });
      return;
    }
    saveAiSettings(storage, { groqApiKey: value });
    input.value = "";
    input.placeholder = maskApiKey(value);
    fetchButton.disabled = false;
    status.textContent = "API key saved locally. Load models to choose one.";
    showToast?.({ type: "success", message: "Groq API key saved locally." });
    onSettingsChanged?.();
  });

  fetchButton?.addEventListener("click", async () => {
    const settings = getAiSettings(storage);
    if (!settings.groqApiKey) return;
    setLoading(fetchButton, true);
    try {
      const models = await fetchGroqModels(settings.groqApiKey);
      const selected = models.find((model) => model.id === settings.groqModel)?.id ?? models[0]?.id ?? "";
      saveAiSettings(storage, { groqModels: models, groqModel: selected, groqModelsFetchedAt: new Date().toISOString() });
      renderModelOptions(modelSelect, models, selected);
      status.textContent = selected ? `Selected model: ${selected}` : "No Groq chat models were returned.";
      showToast?.({ type: "success", message: "Groq models loaded." });
      onSettingsChanged?.();
    } catch (error) {
      status.textContent = error.message;
      showToast?.({ type: "error", message: error.message });
    } finally {
      setLoading(fetchButton, false);
    }
  });

  modelSelect?.addEventListener("change", () => {
    saveAiSettings(storage, { groqModel: modelSelect.value });
    status.textContent = modelSelect.value ? `Selected model: ${modelSelect.value}` : "No AI model selected yet.";
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

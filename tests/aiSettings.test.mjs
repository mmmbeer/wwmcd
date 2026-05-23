import assert from "node:assert/strict";
import test from "node:test";
import {
  getActiveAiProviderSettings,
  getAiSettings,
  hasActiveAiSettings,
  saveAiProviderSettings,
  saveAiSettings
} from "../js/player-combat/ai/aiSettings.js";

test("AI settings keep provider-specific keys and models separate", () => {
  const storage = fakeStorage();

  saveAiProviderSettings(storage, "groq", {
    apiKey: "groq-key",
    model: "llama-model",
    models: [{ id: "llama-model" }]
  });
  saveAiProviderSettings(storage, "openai", {
    apiKey: "openai-key",
    model: "gpt-model",
    models: [{ id: "gpt-model" }]
  });

  let settings = getAiSettings(storage);
  assert.equal(settings.provider, "openai");
  assert.equal(settings.providers.groq.apiKey, "groq-key");
  assert.equal(settings.providers.openai.apiKey, "openai-key");
  assert.equal(getActiveAiProviderSettings(settings).model, "gpt-model");
  assert.equal(hasActiveAiSettings(storage), true);

  saveAiSettings(storage, { provider: "groq" });
  settings = getAiSettings(storage);
  assert.equal(getActiveAiProviderSettings(settings).apiKey, "groq-key");
  assert.equal(getActiveAiProviderSettings(settings).model, "llama-model");
});

test("AI settings migrate legacy Groq settings", () => {
  const storage = fakeStorage({
    ai: {
      groqApiKey: "legacy-key",
      groqModel: "legacy-model",
      groqModels: [{ id: "legacy-model" }]
    }
  });

  const settings = getAiSettings(storage);

  assert.equal(settings.providers.groq.apiKey, "legacy-key");
  assert.equal(settings.providers.groq.model, "legacy-model");
  assert.equal(hasActiveAiSettings(storage), true);
});

function fakeStorage(initialSettings = {}) {
  let settings = initialSettings;
  return {
    getSettings: () => settings,
    saveSettings: (nextSettings) => {
      settings = nextSettings;
    }
  };
}

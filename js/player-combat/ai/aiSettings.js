export const AI_PROVIDERS = [
  { id: "groq", label: "Groq" },
  { id: "openai", label: "OpenAI" }
];

const DEFAULT_PROVIDER_SETTINGS = {
  apiKey: "",
  model: "",
  models: [],
  modelsFetchedAt: null
};

const DEFAULT_AI_SETTINGS = {
  provider: "groq",
  providers: Object.fromEntries(AI_PROVIDERS.map((provider) => [provider.id, { ...DEFAULT_PROVIDER_SETTINGS }]))
};

export function getAiSettings(storage) {
  const saved = storage?.getSettings?.()?.ai ?? {};
  const provider = normalizeProvider(saved.provider);
  const providers = normalizeProviderSettings(saved);
  return {
    ...DEFAULT_AI_SETTINGS,
    ...saved,
    provider,
    providers,
    groqApiKey: providers.groq.apiKey,
    groqModel: providers.groq.model,
    groqModels: providers.groq.models,
    groqModelsFetchedAt: providers.groq.modelsFetchedAt
  };
}

export function saveAiSettings(storage, patch) {
  const settings = storage?.getSettings?.() ?? {};
  const current = getAiSettings(storage);
  const ai = {
    ...DEFAULT_AI_SETTINGS,
    ...(settings.ai ?? {}),
    provider: normalizeProvider(patch.provider ?? current.provider),
    providers: normalizeProviderSettings({
      ...current,
      ...(settings.ai ?? {}),
      ...patch
    })
  };
  storage?.saveSettings?.({
    ...settings,
    ai
  });
  return ai;
}

export function saveAiProviderSettings(storage, provider, patch) {
  const normalizedProvider = normalizeProvider(provider);
  const settings = getAiSettings(storage);
  const currentProviderSettings = settings.providers[normalizedProvider] ?? { ...DEFAULT_PROVIDER_SETTINGS };
  return saveAiSettings(storage, {
    provider: normalizedProvider,
    providers: {
      ...settings.providers,
      [normalizedProvider]: {
        ...currentProviderSettings,
        ...patch
      }
    }
  });
}

export function getActiveAiProviderSettings(settings) {
  const provider = normalizeProvider(settings?.provider);
  return {
    provider,
    label: getAiProviderLabel(provider),
    ...(settings?.providers?.[provider] ?? DEFAULT_PROVIDER_SETTINGS)
  };
}

export function hasActiveAiSettings(storage) {
  const active = getActiveAiProviderSettings(getAiSettings(storage));
  return Boolean(active.apiKey && active.model);
}

export function hasGroqApiKey(storage) {
  return Boolean(getAiSettings(storage).providers.groq.apiKey);
}

export function getAiProviderLabel(provider) {
  return AI_PROVIDERS.find((entry) => entry.id === provider)?.label ?? "AI";
}

export function maskApiKey(value) {
  const text = String(value ?? "");
  if (text.length <= 8) return text ? "Saved" : "Not saved";
  return `${text.slice(0, 4)}...${text.slice(-4)}`;
}

function normalizeProvider(value) {
  return AI_PROVIDERS.some((provider) => provider.id === value) ? value : "groq";
}

function normalizeProviderSettings(saved) {
  const savedProviders = saved.providers && typeof saved.providers === "object" ? saved.providers : {};
  const providers = Object.fromEntries(AI_PROVIDERS.map((provider) => [
    provider.id,
    {
      ...DEFAULT_PROVIDER_SETTINGS,
      ...(savedProviders[provider.id] ?? {})
    }
  ]));

  if (hasLegacyGroqSettings(saved)) {
    providers.groq = {
      ...providers.groq,
      apiKey: saved.groqApiKey || providers.groq.apiKey,
      model: saved.groqModel || providers.groq.model,
      models: Array.isArray(saved.groqModels) && saved.groqModels.length ? saved.groqModels : providers.groq.models,
      modelsFetchedAt: saved.groqModelsFetchedAt || providers.groq.modelsFetchedAt
    };
  }

  return providers;
}

function hasLegacyGroqSettings(saved) {
  return Boolean(saved.groqApiKey)
    || Boolean(saved.groqModel)
    || Boolean(saved.groqModelsFetchedAt)
    || (Array.isArray(saved.groqModels) && saved.groqModels.length > 0);
}

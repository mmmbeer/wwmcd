const DEFAULT_AI_SETTINGS = {
  groqApiKey: "",
  groqModel: "",
  groqModels: [],
  groqModelsFetchedAt: null
};

export function getAiSettings(storage) {
  return {
    ...DEFAULT_AI_SETTINGS,
    ...(storage?.getSettings?.()?.ai ?? {})
  };
}

export function saveAiSettings(storage, patch) {
  const settings = storage?.getSettings?.() ?? {};
  const ai = {
    ...DEFAULT_AI_SETTINGS,
    ...(settings.ai ?? {}),
    ...patch
  };
  storage?.saveSettings?.({
    ...settings,
    ai
  });
  return ai;
}

export function hasGroqApiKey(storage) {
  return Boolean(getAiSettings(storage).groqApiKey);
}

export function maskApiKey(value) {
  const text = String(value ?? "");
  if (text.length <= 8) return text ? "Saved" : "Not saved";
  return `${text.slice(0, 4)}...${text.slice(-4)}`;
}

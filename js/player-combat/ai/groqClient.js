import { fetchAiModels, requestAiChat } from "./aiClient.js";

export async function fetchGroqModels(apiKey) {
  return fetchAiModels({
    provider: "groq",
    apiKey
  });
}

export async function requestGroqChat({ apiKey, model, messages, responseFormat, temperature = 0.2 }) {
  return requestAiChat({
    provider: "groq",
    apiKey,
    model,
    messages,
    responseFormat,
    temperature
  });
}

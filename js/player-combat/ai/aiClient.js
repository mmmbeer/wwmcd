const AI_ENDPOINT = "./api/ai.php";

export async function fetchAiModels({ provider, apiKey }) {
  const payload = await requestAi(`${AI_ENDPOINT}?action=models&provider=${encodeURIComponent(provider)}`, {
    method: "GET",
    apiKey
  });
  return Array.isArray(payload.models) ? payload.models : [];
}

export async function requestAiChat({ provider, apiKey, model, messages, responseFormat, temperature = 0.2 }) {
  return requestAi(`${AI_ENDPOINT}?action=chat&provider=${encodeURIComponent(provider)}`, {
    method: "POST",
    apiKey,
    body: {
      model,
      messages,
      responseFormat,
      temperature
    }
  });
}

async function requestAi(url, { method, apiKey, body = null }) {
  const response = await fetch(url, {
    method,
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "X-Notwithstanding-AI-Api-Key": apiKey
    },
    body: body ? JSON.stringify(body) : null
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error?.message || "AI request failed.");
  }
  return payload;
}

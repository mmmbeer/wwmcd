const GROQ_ENDPOINT = "./api/groq.php";

export async function fetchGroqModels(apiKey) {
  const payload = await requestGroq(`${GROQ_ENDPOINT}?action=models`, {
    method: "GET",
    apiKey
  });
  return Array.isArray(payload.models) ? payload.models : [];
}

export async function requestGroqChat({ apiKey, model, messages, responseFormat, temperature = 0.2 }) {
  return requestGroq(`${GROQ_ENDPOINT}?action=chat`, {
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

async function requestGroq(url, { method, apiKey, body = null }) {
  const response = await fetch(url, {
    method,
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "X-Notwithstanding-Groq-Api-Key": apiKey
    },
    body: body ? JSON.stringify(body) : null
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error?.message || "Groq request failed.");
  }
  return payload;
}

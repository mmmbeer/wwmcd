import { chatBody, completionText, isObject } from "./ai-validation.mjs";
import { error, HttpError, json } from "./responses.mjs";

const PROVIDERS = {
  groq: { label: "Groq", base: "https://api.groq.com/openai/v1", prefix: "NOTWITHSTANDING_GROQ" },
  openai: { label: "OpenAI", base: "https://api.openai.com/v1", prefix: "NOTWITHSTANDING_OPENAI" }
};

async function readBody(request) {
  const raw = await request.text();
  if (!raw.trim()) return {};
  let body;
  try { body = JSON.parse(raw); } catch { throw new HttpError(400, "Request body must be valid JSON."); }
  if (!isObject(body)) throw new HttpError(400, "Request body must be a JSON object.");
  return body;
}

export async function handleAi(request, env, fetcher = fetch) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (!["GET", "POST"].includes(request.method)) {
    return error("Method not allowed.", 405, { Allow: "GET, POST, OPTIONS" });
  }
  // Keys are accepted only from this origin or non-browser clients, never via CORS.
  const url = new URL(request.url);
  const origin = request.headers.get("Origin");
  if ((origin && origin !== url.origin) || request.headers.get("Sec-Fetch-Site") === "cross-site") {
    return error("Cross-origin AI requests are not allowed.", 403);
  }
  try {
    const legacy = url.pathname === "/api/groq.php";
    const provider = legacy ? "groq" : (url.searchParams.get("provider") ?? "groq");
    if (!Object.hasOwn(PROVIDERS, provider)) throw new HttpError(400, "Unsupported AI provider.");
    const config = PROVIDERS[provider];
    const apiKey = request.headers.get("X-Notwithstanding-AI-Api-Key")?.trim() ||
      request.headers.get("X-Notwithstanding-Groq-Api-Key")?.trim() ||
      env[`${config.prefix}_API_KEY`]?.trim();
    if (!apiKey) throw new HttpError(400, `A ${config.label} API key is required. Save one in AI Options.`);

    const body = request.method === "POST" ? await readBody(request) : {};
    const action = url.searchParams.get("action") ?? body.action;
    const models = action === "models" && request.method === "GET";
    const chat = action === "chat" && request.method === "POST";
    if (!models && !chat) throw new HttpError(404, "Unknown AI proxy action.");
    const payload = chat ? chatBody(body) : null;
    const base = (env[`${config.prefix}_BASE_URL`]?.trim() || config.base).replace(/\/+$/, "");
    let response;
    let result;
    try {
      response = await fetcher(`${base}/${models ? "models" : "chat/completions"}`, {
        method: models ? "GET" : "POST",
        headers: {
          Accept: "application/json", Authorization: `Bearer ${apiKey}`,
          ...(chat ? { "Content-Type": "application/json" } : {})
        },
        ...(chat ? { body: JSON.stringify(payload) } : {}),
        redirect: "error",
        signal: AbortSignal.timeout(45_000)
      });
      result = await response.json();
    } catch {
      throw new HttpError(502, `The AI proxy could not read a JSON response from ${config.label}.`);
    }
    if (!isObject(result)) throw new HttpError(502, `${config.label} returned an invalid JSON response.`);
    if (!response.ok) {
      const message = result.error?.message;
      throw new HttpError(response.status, typeof message === "string" ? message : `${config.label} request failed.`);
    }
    if (models) {
      const entries = Array.isArray(result.data) ? result.data : [];
      return json({ ok: true, provider, models: entries
        .filter(entry => typeof entry?.id === "string" && entry.id)
        .map(entry => ({ id: entry.id, ownedBy: typeof entry.owned_by === "string" ? entry.owned_by : null }))
        .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
      });
    }
    return json({
      ok: true, provider, model: typeof result.model === "string" ? result.model : payload.model,
      text: completionText(result)
    });
  } catch (exception) {
    return error(exception instanceof HttpError ? exception.message : "AI proxy request failed.",
      exception instanceof HttpError ? exception.status : 500);
  }
}

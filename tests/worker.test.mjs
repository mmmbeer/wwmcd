import assert from "node:assert/strict";
import test from "node:test";
import worker from "../worker/index.mjs";
import { handleAi } from "../worker/ai.mjs";

const root = "https://help.dndadventurerslog.com";
function request(path = "/api/ai.php?action=models", options = {}) {
  return new Request(`${root}${path}`, {
    ...options, headers: { "X-Notwithstanding-AI-Api-Key": "visitor-key", ...options.headers }
  });
}
function chat(body, path = "/api/ai.php?provider=openai") {
  return request(path, { method: "POST", body: JSON.stringify({
    action: "chat", model: "test-model", messages: [{ role: "user", content: "Plan my turn" }], ...body
  }) });
}

test("Worker health, static assets, and missing API routes stay distinct", async () => {
  const env = { ASSETS: { fetch: async () => new Response("static app") } };
  assert.deepEqual(await (await worker.fetch(new Request(`${root}/api/health`), env)).json(),
    { ok: true, service: "wwmcd" });
  assert.equal(await (await worker.fetch(new Request(`${root}/`), env)).text(), "static app");
  assert.equal((await worker.fetch(new Request(`${root}/api/missing`), env)).status, 404);
  const head = await worker.fetch(new Request(`${root}/api/health`, { method: "HEAD" }), env);
  assert.equal(await head.text(), "");
});

test("Groq models use the visitor key before a server secret and normalize the list", async () => {
  const response = await handleAi(request(), { NOTWITHSTANDING_GROQ_API_KEY: "server-key" }, async (url, init) => {
    assert.equal(url, "https://api.groq.com/openai/v1/models");
    assert.equal(init.headers.Authorization, "Bearer visitor-key");
    assert.equal(init.redirect, "error");
    return Response.json({ data: [{ id: "z" }, null, { id: "a", owned_by: "owner" }, { id: 7 }] });
  });
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { ok: true, provider: "groq", models: [
    { id: "a", ownedBy: "owner" }, { id: "z", ownedBy: null }
  ] });
});

test("OpenAI chat preserves structured output and normalizes text content parts", async () => {
  const format = { type: "json_schema", json_schema: { name: "plan", schema: { type: "object" }, strict: true } };
  const response = await handleAi(chat({ responseFormat: format, temperature: 5 }), {}, async (url, init) => {
    assert.equal(url, "https://api.openai.com/v1/chat/completions");
    const body = JSON.parse(init.body);
    assert.deepEqual(body.response_format, format);
    assert.equal(body.temperature, 2);
    return Response.json({ model: "resolved-model", choices: [{ message: { content: [
      { type: "text", text: "one" }, { type: "other", text: "ignored" }, { type: "text", text: "two" }
    ] } }] });
  });
  assert.deepEqual(await response.json(), { ok: true, provider: "openai", model: "resolved-model", text: "one\ntwo" });
});

test("legacy Groq route and server environment settings work without browser keys", async () => {
  const response = await handleAi(new Request(`${root}/api/groq.php?action=models&provider=openai`), {
    NOTWITHSTANDING_GROQ_API_KEY: "server-key", NOTWITHSTANDING_GROQ_BASE_URL: "https://gateway.example/v1/"
  }, async (url, init) => {
    assert.equal(url, "https://gateway.example/v1/models");
    assert.equal(init.headers.Authorization, "Bearer server-key");
    return Response.json({ data: [] });
  });
  assert.equal((await response.json()).provider, "groq");
});

test("invalid requests fail before making a provider request", async () => {
  const cases = [
    [new Request(`${root}/api/ai.php?action=models`), 400],
    [request("/api/ai.php?provider=constructor&action=models"), 400],
    [request("/api/ai.php?action=unknown"), 404],
    [request("/api/ai.php", { method: "DELETE" }), 405],
    [request("/api/ai.php", { method: "POST", body: "{" }), 400],
    [request("/api/ai.php", { method: "POST", body: "[]" }), 400],
    [chat({ model: "" }), 400],
    [chat({ messages: [null, { role: "tool", content: "no" }] }), 400],
    [chat({ responseFormat: { type: "xml" } }), 400],
    [chat({ responseFormat: { type: "json_schema", json_schema: { name: "x", schema: {}, strict: "yes" } } }), 400],
    [request(undefined, { headers: { Origin: "https://other.example" } }), 403]
  ];
  for (const [input, status] of cases) {
    const response = await handleAi(input, {}, () => assert.fail("Must not contact provider"));
    assert.equal(response.status, status);
    assert.equal((await response.json()).ok, false);
  }
});

test("provider errors keep their status and message for structured output fallback", async () => {
  const response = await handleAi(chat({}), {}, async () => Response.json({
    error: { message: "json_schema is not supported" }
  }, { status: 400 }));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.message, "json_schema is not supported");
});

test("network and malformed provider responses become JSON gateway errors", async () => {
  for (const fetcher of [
    async () => { throw new Error("network error with sensitive details"); },
    async () => new Response("<html>Error</html>"),
    async () => Response.json(null),
    async () => Response.json({ choices: [] })
  ]) {
    const response = await handleAi(chat({}), {}, fetcher);
    assert.equal(response.status, 502);
    assert.equal((await response.json()).ok, false);
  }
});

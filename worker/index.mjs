import { handleAi } from "./ai.mjs";
import { error, json } from "./responses.mjs";

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/health") {
      if (!["GET", "HEAD"].includes(request.method)) return error("Method not allowed.", 405);
      const response = json({ ok: true, service: "wwmcd" });
      return request.method === "HEAD" ? new Response(null, response) : response;
    }
    if (["/api/ai", "/api/ai.php", "/api/groq.php"].includes(pathname)) {
      return handleAi(request, env);
    }
    if (pathname === "/api" || pathname.startsWith("/api/")) return error("Not found.", 404);
    return env.ASSETS.fetch(request);
  }
};

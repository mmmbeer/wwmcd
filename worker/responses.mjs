export function json(payload, status = 200, headers = {}) {
  return Response.json(payload, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers }
  });
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function error(message, status = 400, headers = {}) {
  return json({ ok: false, error: { message } }, status, headers);
}

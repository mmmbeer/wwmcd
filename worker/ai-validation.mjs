import { HttpError } from "./responses.mjs";

export function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function responseFormat(value) {
  if (value == null) return undefined;
  if (!isObject(value) || typeof value.type !== "string") {
    throw new HttpError(400, "responseFormat must be an object with a string type.");
  }
  if (value.type === "json_object") return { type: "json_object" };
  if (value.type !== "json_schema") throw new HttpError(400, "Unsupported responseFormat type.");
  const schema = value.json_schema;
  if (!isObject(schema) || typeof schema.name !== "string" || !schema.name.trim() || !isObject(schema.schema)) {
    throw new HttpError(400, "json_schema responseFormat requires name and schema.");
  }
  if (schema.strict != null && typeof schema.strict !== "boolean") {
    throw new HttpError(400, "json_schema.strict must be a boolean when provided.");
  }
  return {
    type: "json_schema",
    json_schema: {
      name: schema.name.trim(), schema: schema.schema,
      ...(schema.strict == null ? {} : { strict: schema.strict })
    }
  };
}

export function chatBody(body) {
  const model = typeof body.model === "string" ? body.model.trim() : "";
  if (!model) throw new HttpError(400, "An AI model is required.");
  if (!Array.isArray(body.messages) || !body.messages.length) {
    throw new HttpError(400, "At least one chat message is required.");
  }
  const messages = body.messages.filter(message =>
    ["system", "user", "assistant"].includes(message?.role) &&
    typeof message?.content === "string" && message.content.trim()
  ).map(({ role, content }) => ({ role, content: content.trim() }));
  if (!messages.length) throw new HttpError(400, "No valid chat messages were provided.");
  const temperature = Number(body.temperature ?? 0.2);
  const format = responseFormat(body.responseFormat);
  return {
    model, messages,
    temperature: Number.isFinite(temperature) ? Math.max(0.1, Math.min(2, temperature)) : 0.2,
    ...(format ? { response_format: format } : {})
  };
}

export function completionText(payload) {
  const message = payload.choices?.[0]?.message;
  if (!isObject(message)) throw new HttpError(502, "The AI provider returned no completion message.");
  if (typeof message.content === "string") return message.content.trim();
  if (Array.isArray(message.content)) {
    return message.content.filter(part => part?.type === "text" && typeof part.text === "string")
      .map(part => part.text).join("\n").trim();
  }
  throw new HttpError(502, "The AI provider returned no text content.");
}

import { requestGroqChat } from "./groqClient.js";
import { AI_RECOMMENDATION_SYSTEM_PROMPT } from "./aiRecommendationPrompt.js";

const FALLBACK_JSON_PROMPT = `The selected model does not support Groq structured outputs.
Return ONLY valid JSON. Do not include Markdown fences, comments, prose before the JSON, or prose after the JSON.
The response must be a single JSON object with this exact shape:
{
  "recommendations": [
    {
      "rank": 1,
      "title": "short turn-plan title",
      "score": 100,
      "explanation": "why this complete turn plan is recommended",
      "actions": [
        {
          "slot": "Action, Bonus, Reaction, Move, Free, Attack 1, Attack 2, Rider, or Special",
          "optionId": "copy the exact id from an available option when possible",
          "name": "copy the exact option name",
          "explanation": "why this piece belongs in the plan"
        }
      ],
      "reasons": ["short reason"],
      "warnings": ["short warning, or empty array"]
    }
  ]
}
Use one to six recommendations. Use one to eight actions per recommendation.`;

export async function getAiRecommendations({ apiKey, model, context, chatClient = requestGroqChat }) {
  const request = structuredRecommendationRequest({ apiKey, model, context });
  let payload;
  try {
    payload = await chatClient(request);
  } catch (error) {
    if (!isStructuredOutputUnsupportedError(error)) throw error;
    payload = await chatClient(fallbackRecommendationRequest({ apiKey, model, context }));
  }

  return normalizeAiResponse(payload.text, context.availableOptions);
}

export function isStructuredOutputUnsupportedError(error) {
  const message = String(error?.message ?? error ?? "").toLowerCase();
  return message.includes("json_schema")
    || message.includes("structured output")
    || message.includes("structured outputs")
    || message.includes("response format");
}

function structuredRecommendationRequest({ apiKey, model, context }) {
  return {
    apiKey,
    model,
    temperature: 0.2,
    responseFormat: recommendationResponseFormat(),
    messages: [
      { role: "system", content: AI_RECOMMENDATION_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          "Recommend the best D&D 5e turn plans for the current player character.",
          "Return JSON matching the requested schema.",
          JSON.stringify(context)
        ].join("\n\n")
      }
    ]
  };
}

function fallbackRecommendationRequest({ apiKey, model, context }) {
  return {
    apiKey,
    model,
    temperature: 0.1,
    messages: [
      { role: "system", content: `${AI_RECOMMENDATION_SYSTEM_PROMPT}\n${FALLBACK_JSON_PROMPT}` },
      {
        role: "user",
        content: [
          "Recommend the best D&D 5e turn plans for the current player character.",
          "Use the fallback JSON-only response contract exactly.",
          JSON.stringify(context)
        ].join("\n\n")
      }
    ]
  };
}

function normalizeAiResponse(text, availableOptions) {
  const parsed = parseJson(text);
  const sets = Array.isArray(parsed?.recommendations) ? parsed.recommendations : [];
  const optionMap = buildOptionMap(availableOptions);
  return sets.slice(0, 6).map((set, index) => ({
    id: `ai-recommendation-${index + 1}`,
    rank: Number(set.rank) || index + 1,
    title: stringOr(set.title, `AI turn plan ${index + 1}`),
    score: Number(set.score) || 0,
    summary: stringOr(set.explanation, ""),
    pieces: normalizePieces(set.actions, optionMap),
    reasons: arrayOfStrings(set.reasons).slice(0, 6),
    warnings: arrayOfStrings(set.warnings).slice(0, 4)
  })).sort((left, right) => left.rank - right.rank);
}

function normalizePieces(actions, optionMap) {
  return (Array.isArray(actions) ? actions : []).slice(0, 8).map((action) => {
    const optionId = stringOr(action.optionId, "");
    const matched = optionMap.get(optionId) ?? optionMap.get(stringOr(action.name, "").toLowerCase());
    return {
      slot: stringOr(action.slot, "Action"),
      optionId: matched?.id ?? optionId,
      name: matched?.name ?? stringOr(action.name, "Recommended option"),
      explanation: stringOr(action.explanation, ""),
      option: matched ?? null
    };
  });
}

function buildOptionMap(groups) {
  const map = new Map();
  Object.values(groups ?? {}).flat().forEach((option) => {
    if (!option?.id) return;
    map.set(option.id, option);
    map.set(String(option.name ?? "").toLowerCase(), option);
  });
  return map;
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = String(text ?? "").match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Groq returned a recommendation response that was not valid JSON.");
    return JSON.parse(match[0]);
  }
}

function arrayOfStrings(value) {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];
}

function stringOr(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function recommendationResponseFormat() {
  return {
    type: "json_schema",
    json_schema: {
      name: "combat_recommendations",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["recommendations"],
        properties: {
          recommendations: {
            type: "array",
            minItems: 1,
            maxItems: 6,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["rank", "title", "score", "explanation", "actions", "reasons", "warnings"],
              properties: {
                rank: { type: "integer" },
                title: { type: "string" },
                score: { type: "number" },
                explanation: { type: "string" },
                actions: {
                  type: "array",
                  minItems: 1,
                  maxItems: 8,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["slot", "optionId", "name", "explanation"],
                    properties: {
                      slot: { type: "string" },
                      optionId: { type: "string" },
                      name: { type: "string" },
                      explanation: { type: "string" }
                    }
                  }
                },
                reasons: { type: "array", items: { type: "string" } },
                warnings: { type: "array", items: { type: "string" } }
              }
            }
          }
        }
      }
    }
  };
}

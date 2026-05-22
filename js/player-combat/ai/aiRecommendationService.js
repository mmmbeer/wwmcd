import { requestGroqChat } from "./groqClient.js";

const SYSTEM_PROMPT = `You are a D&D 5e combat recommendation assistant for a player-facing turn helper.
Use only the provided character, combat state, available options, resources, spell slots, equipment, traits, features, conditions, and wizard answers.
Rank complete turn plans from best to worst for the current tactical goal.
Respect action economy, availability, spell-slot limits, limited resources, concentration, range, rolls, and current conditions.
Do not invent actions, spells, features, equipment, resources, or character facts.
Return concise explanations that help the player understand why each plan is recommended.`;

export async function getAiRecommendations({ apiKey, model, context }) {
  const payload = await requestGroqChat({
    apiKey,
    model,
    temperature: 0.2,
    responseFormat: recommendationResponseFormat(),
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          "Recommend the best D&D 5e turn plans for the current player character.",
          "Return JSON matching the requested schema.",
          JSON.stringify(context)
        ].join("\n\n")
      }
    ]
  });

  return normalizeAiResponse(payload.text, context.availableOptions);
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

const PLAN_PIECE_DESCRIPTION = {
  type: "object",
  additionalProperties: false,
  required: ["slot", "optionId", "name", "explanation"],
  properties: {
    slot: {
      type: "string",
      description: "Action, Attack 1, Attack 2, Bonus Action, Rider, Special, Free, Move, or Reaction."
    },
    optionId: { type: ["string", "null"] },
    name: { type: "string" },
    explanation: { type: "string" }
  }
};

const OPTION_AUDIT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["dataWarnings", "ignoredDeterministicRecommendations", "highValueTacticalHooks"],
  properties: {
    dataWarnings: { type: "array", items: { type: "string" } },
    ignoredDeterministicRecommendations: { type: "array", items: { type: "string" } },
    highValueTacticalHooks: { type: "array", items: { type: "string" } }
  }
};

export const JSON_ONLY_PROMPT = `Return ONLY valid JSON. Do not include Markdown fences, comments, prose before the JSON, or prose after the JSON.
The response must be a single JSON object with this exact shape:
{
  "guidance": "brief tactical guidance for the player",
  "missingInfo": ["important missing fact"],
  "optionAudit": {
    "dataWarnings": ["data issue noticed or none"],
    "ignoredDeterministicRecommendations": ["candidate ignored or downgraded"],
    "highValueTacticalHooks": ["important tactical hook used"]
  },
  "recommendations": [
    {
      "id": "rec-1",
      "rank": 1,
      "category": "best_overall",
      "title": "short complete turn title",
      "score": 100,
      "confidence": "high",
      "legality": "legal",
      "riskLevel": "medium",
      "explanation": "why this complete turn plan is recommended",
      "planPieces": [
        {
          "slot": "Action",
          "optionId": "copy the exact id from an available option",
          "name": "copy the exact option name",
          "explanation": "what this piece contributes"
        },
        {
          "slot": "Bonus Action",
          "optionId": null,
          "name": "None",
          "explanation": "No useful bonus action this turn."
        }
      ],
      "resourcesUsed": ["resource name"],
      "concentrationImpact": "none, starts concentration, maintains concentration, or replaces existing concentration",
      "assumptions": ["assumption"],
      "reasons": ["short reason"],
      "warnings": ["short warning"],
      "rejectedAlternatives": [
        { "optionId": "exact option id", "name": "option name", "reason": "why it was not ranked higher" }
      ],
      "whyNotHigher": "why this plan is not ranked above stronger plans, or empty for the top plan"
    }
  ]
}
Use one to six recommendations. Each recommendation may include multiple planPieces when the options legally combine.`;

export const FALLBACK_JSON_PROMPT = `The selected model does not support structured outputs.
${JSON_ONLY_PROMPT}`;

export function recommendationResponseFormat() {
  return {
    type: "json_schema",
    json_schema: {
      name: "combat_turn_recommendations",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["guidance", "missingInfo", "optionAudit", "recommendations"],
        properties: {
          guidance: { type: "string" },
          missingInfo: { type: "array", items: { type: "string" } },
          optionAudit: OPTION_AUDIT_SCHEMA,
          recommendations: {
            type: "array",
            minItems: 1,
            maxItems: 6,
            items: recommendationSchema()
          }
        }
      }
    }
  };
}

function recommendationSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "id", "rank", "category", "title", "score", "confidence", "legality",
      "riskLevel", "explanation", "planPieces", "resourcesUsed",
      "concentrationImpact", "assumptions", "reasons", "warnings",
      "rejectedAlternatives", "whyNotHigher"
    ],
    properties: {
      id: { type: "string" },
      rank: { type: "integer" },
      category: {
        type: "string",
        enum: ["best_overall", "damage", "defense", "support", "control", "resource_conserving", "escape_or_reposition", "other"]
      },
      title: { type: "string" },
      score: { type: "number" },
      confidence: { type: "string", enum: ["low", "medium", "high"] },
      legality: { type: "string", enum: ["legal", "conditional", "risky", "invalid"] },
      riskLevel: { type: "string", enum: ["low", "medium", "high"] },
      explanation: { type: "string" },
      planPieces: {
        type: "array",
        minItems: 1,
        maxItems: 10,
        items: PLAN_PIECE_DESCRIPTION
      },
      resourcesUsed: { type: "array", items: { type: "string" } },
      concentrationImpact: { type: "string" },
      assumptions: { type: "array", items: { type: "string" } },
      reasons: { type: "array", items: { type: "string" } },
      warnings: { type: "array", items: { type: "string" } },
      rejectedAlternatives: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["optionId", "name", "reason"],
          properties: {
            optionId: { type: "string" },
            name: { type: "string" },
            reason: { type: "string" }
          }
        }
      },
      whyNotHigher: { type: "string" }
    }
  };
}

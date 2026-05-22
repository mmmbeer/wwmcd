import { requestGroqChat } from "./groqClient.js";
import { AI_RECOMMENDATION_SYSTEM_PROMPT } from "./aiRecommendationPrompt.js";

const FALLBACK_JSON_PROMPT = `The selected model does not support Groq structured outputs.
Return ONLY valid JSON. Do not include Markdown fences, comments, prose before the JSON, or prose after the JSON.
The response must be a single JSON object with this exact shape:
{
  "turnAssessment": "brief tactical assessment",
  "recommendedOptionId": "id of the best recommendation",
  "missingInfo": ["important missing fact"],
  "recommendations": [
    {
      "id": "rec-1",
      "rank": 1,
      "category": "best_overall",
      "title": "short turn-plan title",
      "score": 100,
      "confidence": "high",
      "legality": "legal",
      "riskLevel": "medium",
      "explanation": "why this complete turn plan is recommended",
      "expectedOutcome": "what this plan is trying to accomplish",
      "movement": "movement recommendation or none",
      "action": {
        "slot": "Action",
        "optionId": "copy the exact id from an available option when possible",
        "name": "copy the exact option name",
        "explanation": "why this action belongs in the plan"
      },
      "bonusAction": {
        "slot": "Bonus Action",
        "optionId": "",
        "name": "None",
        "explanation": "no useful bonus action available"
      },
      "freeInteraction": "brief note or none",
      "reactionPlan": "reaction guidance for after the turn",
      "resourcesUsed": ["resource name"],
      "concentrationImpact": "none, starts concentration, maintains concentration, or replaces existing concentration",
      "assumptions": ["assumption"],
      "reasons": ["short reason"],
      "warnings": ["short warning"]
    }
  ]
}
Use one to six recommendations.`;

export async function getAiRecommendations({ apiKey, model, context, chatClient = requestGroqChat }) {
  const request = structuredRecommendationRequest({ apiKey, model, context });
  let payload;
  try {
    payload = await chatClient(request);
  } catch (error) {
    if (!isStructuredOutputUnsupportedError(error)) throw error;
    payload = await chatClient(fallbackRecommendationRequest({ apiKey, model, context }));
  }

  return normalizeAiResponse(payload.text, context);
}

export function isStructuredOutputUnsupportedError(error) {
  const message = String(error?.message ?? error ?? "").toLowerCase();
  return message.includes("json_schema")
    || message.includes("structured output")
    || message.includes("structured outputs")
    || message.includes("response format");
}

export function shouldAskClarifyingQuestion(aiResult) {
  return (
    aiResult.missingInfo?.length >= 3 &&
    aiResult.recommendations?.every((rec) => rec.legality !== "legal")
  );
}

export function buildRecommendationUserMessage(context) {
  return [
    "Recommend practical D&D 5e turn plans for the current player character.",
    "",
    "Requirements:",
    "- Return ranked complete turn plans, not individual actions.",
    "- Use optionId values from optionIndex or availableOptions whenever possible.",
    "- Include different tactical categories when possible.",
    "- Mark plans conditional if range, line of sight, target validity, concentration, or resources are uncertain.",
    "- Include missingInfo for facts that would materially change the recommendation.",
    "- Prefer useful, table-ready guidance over long rules explanation.",
    "",
    "Context JSON:",
    JSON.stringify(context)
  ].join("\n");
}

function structuredRecommendationRequest({ apiKey, model, context }) {
  return {
    apiKey,
    model,
    temperature: 0.15,
    responseFormat: recommendationResponseFormat(),
    messages: [
      { role: "system", content: AI_RECOMMENDATION_SYSTEM_PROMPT },
      { role: "user", content: buildRecommendationUserMessage(context) }
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
      { role: "user", content: buildRecommendationUserMessage(context) }
    ]
  };
}

export function normalizeAiResponse(text, contextOrOptions) {
  const parsed = parseJson(text);
  const sets = Array.isArray(parsed?.recommendations) ? parsed.recommendations : [];
  const optionMap = buildOptionMap(contextOrOptions);
  const recommendations = sets.slice(0, 6)
    .map((set, index) => normalizeRecommendationSet(set, index, optionMap))
    .sort((left, right) => left.rank - right.rank);

  return {
    turnAssessment: stringOr(parsed?.turnAssessment, ""),
    recommendedOptionId: stringOr(parsed?.recommendedOptionId, ""),
    missingInfo: arrayOfStrings(parsed?.missingInfo).slice(0, 8),
    recommendations,
    sets: recommendations
  };
}

export function normalizeRecommendationSet(set, index, optionMap) {
  const legacyPieces = Array.isArray(set.actions) ? set.actions : [];
  const action = normalizeActionPiece(set.action ?? legacyPieces[0], optionMap, "Action");
  const bonusAction = normalizeActionPiece(set.bonusAction ?? legacyPieces.find(isBonusPiece), optionMap, "Bonus Action");
  const extraPieces = legacyPieces.slice(1).filter((piece) => !isBonusPiece(piece)).map((piece) => (
    normalizeActionPiece(piece, optionMap, stringOr(piece.slot, "Action"))
  ));

  const validationWarnings = [
    ...validateMatchedPiece(action),
    ...validateMatchedPiece(bonusAction),
    ...extraPieces.flatMap(validateMatchedPiece)
  ];
  const warnings = [...arrayOfStrings(set.warnings), ...validationWarnings].slice(0, 8);
  const legality = validationWarnings.length
    ? downgradeLegality(stringOr(set.legality, "conditional"))
    : legalEnum(set.legality, "conditional");

  return {
    id: stringOr(set.id, `ai-recommendation-${index + 1}`),
    rank: Number(set.rank) || index + 1,
    category: categoryEnum(set.category),
    title: stringOr(set.title, `AI turn plan ${index + 1}`),
    score: Number(set.score) || 0,
    confidence: confidenceEnum(set.confidence, "medium"),
    legality,
    riskLevel: riskEnum(set.riskLevel, "medium"),
    summary: stringOr(set.explanation, ""),
    expectedOutcome: stringOr(set.expectedOutcome, ""),
    movement: stringOr(set.movement, "No movement specified."),
    action,
    bonusAction,
    freeInteraction: stringOr(set.freeInteraction, ""),
    reactionPlan: stringOr(set.reactionPlan, ""),
    resourcesUsed: arrayOfStrings(set.resourcesUsed).slice(0, 6),
    concentrationImpact: stringOr(set.concentrationImpact, "none"),
    assumptions: arrayOfStrings(set.assumptions).slice(0, 8),
    reasons: arrayOfStrings(set.reasons).slice(0, 6),
    warnings,
    pieces: [action, bonusAction, ...extraPieces].filter(Boolean)
  };
}

export function normalizeActionPiece(piece, optionMap, fallbackSlot) {
  if (!piece || typeof piece !== "object") {
    return {
      slot: fallbackSlot,
      optionId: "",
      name: "None",
      explanation: "",
      option: null,
      validation: []
    };
  }

  const optionId = stringOr(piece.optionId, "");
  const name = stringOr(piece.name, "");
  const matched = optionMap.get(optionId) ?? optionMap.get(name.toLowerCase());

  return {
    slot: stringOr(piece.slot, fallbackSlot),
    optionId: matched?.id ?? optionId,
    name: matched?.name ?? name,
    explanation: stringOr(piece.explanation, ""),
    option: matched ?? null,
    validation: matched || name.toLowerCase() === "none"
      ? []
      : [`No matching available option found for "${name || optionId}".`]
  };
}

export function validateMatchedPiece(piece) {
  if (!piece) return [];
  const warnings = [...(piece.validation ?? [])];
  if (piece.option?.available === false) {
    warnings.push(`"${piece.option.name}" is marked unavailable: ${(piece.option.unavailableReasons ?? []).join(", ")}`);
  }
  return warnings;
}

export function downgradeLegality(value) {
  return value === "invalid" ? "invalid" : "conditional";
}

function isBonusPiece(piece) {
  return String(piece?.slot ?? "").toLowerCase().includes("bonus");
}

function buildOptionMap(contextOrOptions) {
  const map = new Map();
  const groups = contextOrOptions?.availableOptions
    ? [contextOrOptions.availableOptions, contextOrOptions.unavailableOptions]
    : [contextOrOptions];
  groups.forEach((groupSet) => {
    Object.values(groupSet ?? {}).flat().forEach((option) => {
      if (!option?.id) return;
      map.set(option.id, option);
      map.set(String(option.name ?? "").toLowerCase(), option);
    });
  });
  return map;
}

export function parseJson(text) {
  const raw = String(text ?? "").trim();
  try {
    return JSON.parse(raw);
  } catch {
    const extracted = extractFirstJsonObject(raw);
    if (!extracted) {
      throw new Error("Groq returned a recommendation response that was not valid JSON.");
    }
    return JSON.parse(extracted);
  }
}

export function extractFirstJsonObject(text) {
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === "\"") inString = false;
      continue;
    }
    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === "{") {
      if (depth === 0) start = i;
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0 && start !== -1) return text.slice(start, i + 1);
    }
  }

  return null;
}

function arrayOfStrings(value) {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];
}

function stringOr(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function categoryEnum(value) {
  return enumOr(value, [
    "best_overall",
    "damage",
    "defense",
    "support",
    "control",
    "resource_conserving",
    "escape_or_reposition",
    "other"
  ], "other");
}

function confidenceEnum(value, fallback) {
  return enumOr(value, ["low", "medium", "high"], fallback);
}

function legalEnum(value, fallback) {
  return enumOr(value, ["legal", "conditional", "risky", "invalid"], fallback);
}

function riskEnum(value, fallback) {
  return enumOr(value, ["low", "medium", "high"], fallback);
}

function enumOr(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
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
        required: ["turnAssessment", "recommendedOptionId", "missingInfo", "recommendations"],
        properties: {
          turnAssessment: { type: "string" },
          recommendedOptionId: { type: "string" },
          missingInfo: { type: "array", items: { type: "string" } },
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
      "riskLevel", "explanation", "expectedOutcome", "movement", "action",
      "bonusAction", "freeInteraction", "reactionPlan", "resourcesUsed",
      "concentrationImpact", "assumptions", "reasons", "warnings"
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
      expectedOutcome: { type: "string" },
      movement: { type: "string" },
      action: actionPieceSchema(),
      bonusAction: actionPieceSchema(),
      freeInteraction: { type: "string" },
      reactionPlan: { type: "string" },
      resourcesUsed: { type: "array", items: { type: "string" } },
      concentrationImpact: { type: "string" },
      assumptions: { type: "array", items: { type: "string" } },
      reasons: { type: "array", items: { type: "string" } },
      warnings: { type: "array", items: { type: "string" } }
    }
  };
}

function actionPieceSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["slot", "optionId", "name", "explanation"],
    properties: {
      slot: { type: "string" },
      optionId: { type: "string" },
      name: { type: "string" },
      explanation: { type: "string" }
    }
  };
}

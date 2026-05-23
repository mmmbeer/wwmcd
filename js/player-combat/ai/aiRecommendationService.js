import { requestAiChat } from "./aiClient.js";
import { AI_RECOMMENDATION_SYSTEM_PROMPT } from "./aiRecommendationPrompt.js";
import { compactContextForRequest } from "./aiRecommendationRequestContext.js";
import {
  FALLBACK_JSON_PROMPT,
  JSON_ONLY_PROMPT,
  recommendationResponseFormat
} from "./aiRecommendationResponseContract.js";

export async function getAiRecommendations({ provider = "groq", apiKey, model, context, chatClient = requestAiChat }) {
  const request = shouldUseJsonSchema({ provider, model })
    ? structuredRecommendationRequest({ provider, apiKey, model, context })
    : jsonObjectRecommendationRequest({ provider, apiKey, model, context });
  let payload;
  try {
    payload = await chatClient(request);
  } catch (error) {
    if (!request.responseFormat || request.responseFormat.type !== "json_schema" || !isStructuredOutputUnsupportedError(error)) {
      throw error;
    }
    payload = await chatClient(jsonObjectRecommendationRequest({ provider, apiKey, model, context, fallback: true }));
  }

  return normalizeAiResponse(payload.text, context);
}

export function shouldUseJsonSchema({ provider, model } = {}) {
  const normalizedProvider = String(provider ?? "").toLowerCase();
  const normalizedModel = String(model ?? "").toLowerCase();
  if (normalizedProvider === "groq") return false;
  if (/llama|mixtral|gemma|deepseek|qwen/.test(normalizedModel)) return false;
  return true;
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
  const requestContext = compactContextForRequest(context);
  return [
    "Recommend practical D&D 5e combat turn plans for the current player character.",
    "",
    "Requirements:",
    "- Return a ranked list of complete turn plans using planPieces.",
    "- Use optionId values from optionIndex. availableOptions may be grouped ID lists for orientation.",
    "- Use battlefieldKnowledge to avoid obviously poor damage types or tactics against named creatures from the notes.",
    "- Use classTactics only to rank, explain, warn, or identify missing information; do not treat them as extra options.",
    "- Each planPiece must reference one concrete option from optionIndex or availableOptions.",
    "- Combine compatible pieces when useful: attacks, Extra Attack pieces, bonus actions, riders, resource spends, free/object interactions, movement, and reaction reminders.",
    "- Examples of useful combinations include Steady Aim plus Longbow plus Sneak Attack, weapon attack plus Divine Smite, and monk weapon plus Flurry of Blows when those option IDs are present.",
    "- Include class-feature riders such as Sneak Attack, Divine Smite, Stunning Strike, or Flurry of Blows only when they appear as provided options; mark hit-triggered riders conditional if the hit has not happened yet.",
    "- Do not include more than one explicit Action or one Bonus Action unless the app-provided option is an Extra Attack/attack-count piece.",
    "- Include different tactical categories when useful.",
    "- Mark plans conditional if range, line of sight, target validity, concentration, or resources are uncertain.",
    "- Prefer strong ranged options over closing to melee for fragile or wounded characters unless the provided context supports closing.",
    "- Include missingInfo for facts that would materially change the recommendation.",
    "- Prefer useful, table-ready guidance over long rules explanation.",
    "",
    "Context JSON:",
    JSON.stringify(requestContext)
  ].join("\n");
}

export { compactContextForRequest };

function structuredRecommendationRequest({ provider, apiKey, model, context }) {
  return {
    provider,
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

function jsonObjectRecommendationRequest({ provider, apiKey, model, context, fallback = false }) {
  return {
    provider,
    apiKey,
    model,
    temperature: 0.1,
    responseFormat: { type: "json_object" },
    messages: [
      { role: "system", content: `${AI_RECOMMENDATION_SYSTEM_PROMPT}\n${fallback ? FALLBACK_JSON_PROMPT : JSON_ONLY_PROMPT}` },
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
    guidance: stringOr(parsed?.guidance, ""),
    turnAssessment: stringOr(parsed?.turnAssessment, ""),
    recommendedOptionId: stringOr(parsed?.recommendedOptionId, ""),
    missingInfo: arrayOfStrings(parsed?.missingInfo).slice(0, 8),
    recommendations,
    sets: recommendations
  };
}

export function normalizeRecommendationSet(set, index, optionMap) {
  const safeSet = set && typeof set === "object" ? set : {};
  const legacyPieces = Array.isArray(safeSet.actions) ? safeSet.actions : [];
  const normalizedPlanPieces = normalizePlanPieces(safeSet.planPieces, optionMap);
  const hasPlanPieces = normalizedPlanPieces.length > 0;
  const action = hasPlanPieces
    ? findPlanPiece(normalizedPlanPieces, isActionPiece) ?? normalizeActionPiece(safeSet.action, optionMap, "Action")
    : normalizeActionPiece(safeSet.action ?? legacyPieces[0], optionMap, "Action");
  const bonusAction = hasPlanPieces
    ? findPlanPiece(normalizedPlanPieces, isBonusPiece) ?? normalizeActionPiece(safeSet.bonusAction, optionMap, "Bonus Action")
    : normalizeActionPiece(safeSet.bonusAction ?? legacyPieces.find(isBonusPiece), optionMap, "Bonus Action");
  const pieces = hasPlanPieces
    ? normalizedPlanPieces
    : [
      action,
      bonusAction,
      legacySingleOptionPiece(safeSet, optionMap, action),
      ...legacyPieces.slice(1).filter((piece) => !isBonusPiece(piece)).map((piece) => (
      normalizeActionPiece(piece, optionMap, stringOr(piece.slot, "Action"))
    ))].filter((piece) => piece && (piece.name.toLowerCase() !== "none" || piece.optionId));

  const validationWarnings = [
    ...pieces.flatMap(validateMatchedPiece),
    ...validateActionEconomy(pieces)
  ];
  const warnings = [...arrayOfStrings(safeSet.warnings), ...validationWarnings].slice(0, 8);
  const legality = validationWarnings.length
    ? downgradeLegality(stringOr(safeSet.legality, "conditional"))
    : legalEnum(safeSet.legality, "conditional");
  const primaryPiece = action.optionId || action.name !== "None" ? action : pieces[0] ?? action;

  return {
    id: stringOr(safeSet.id, `ai-recommendation-${index + 1}`),
    rank: Number(safeSet.rank) || index + 1,
    category: categoryEnum(safeSet.category),
    title: stringOr(safeSet.title, `AI turn plan ${index + 1}`),
    optionId: primaryPiece.optionId,
    name: primaryPiece.name,
    option: primaryPiece.option,
    score: Number(safeSet.score) || 0,
    confidence: confidenceEnum(safeSet.confidence, "medium"),
    legality,
    riskLevel: riskEnum(safeSet.riskLevel, "medium"),
    summary: stringOr(safeSet.explanation, ""),
    expectedOutcome: stringOr(safeSet.expectedOutcome, ""),
    movement: stringOr(safeSet.movement, "No movement specified."),
    action,
    bonusAction,
    freeInteraction: stringOr(safeSet.freeInteraction, ""),
    reactionPlan: stringOr(safeSet.reactionPlan, ""),
    resourcesUsed: arrayOfStrings(safeSet.resourcesUsed).slice(0, 6),
    concentrationImpact: stringOr(safeSet.concentrationImpact, "none"),
    assumptions: arrayOfStrings(safeSet.assumptions).slice(0, 8),
    reasons: arrayOfStrings(safeSet.reasons).slice(0, 6),
    warnings,
    pieces
  };
}

function legacySingleOptionPiece(set, optionMap, existingAction) {
  if (existingAction?.optionId || existingAction?.name !== "None") return null;
  if (!set?.optionId && !set?.name) return null;
  return normalizeActionPiece({
    slot: stringOr(set.slot, "Action"),
    optionId: stringOr(set.optionId, ""),
    name: stringOr(set.name, ""),
    explanation: stringOr(set.explanation, "")
  }, optionMap, "Action");
}

function normalizePlanPieces(pieces, optionMap) {
  if (!Array.isArray(pieces)) return [];
  return pieces
    .slice(0, 10)
    .map((piece) => normalizeActionPiece(piece, optionMap, stringOr(piece?.slot, "Action")))
    .filter((piece) => piece.name.toLowerCase() !== "none" || piece.optionId);
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
  const { option: matched, matchedByNameOnly, ambiguousName } = findMatchingOption({ optionId, name, optionMap });
  const validation = [];
  if (matchedByNameOnly) {
    validation.push(`Matched "${matched.name}" by name only because optionId was missing.`);
  } else if (ambiguousName) {
    validation.push(`Multiple available options are named "${name}"; provide optionId to disambiguate.`);
  } else if (!matched && name.toLowerCase() !== "none") {
    validation.push(`No matching available option found for "${name || optionId}".`);
  }

  return {
    slot: stringOr(piece.slot, fallbackSlot),
    optionId: matched?.id ?? optionId,
    name: matched?.name ?? name,
    explanation: stringOr(piece.explanation, ""),
    option: matched ?? null,
    validation
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

function isActionPiece(piece) {
  const slot = String(piece?.slot ?? "").toLowerCase();
  return slot.includes("action") || slot.includes("attack");
}

function findPlanPiece(pieces, predicate) {
  return pieces.find(predicate) ?? null;
}

function buildOptionMap(contextOrOptions) {
  const byId = new Map();
  const nameBuckets = new Map();
  const groups = contextOrOptions?.availableOptions
    ? [contextOrOptions.availableOptions, contextOrOptions.unavailableOptions]
    : [contextOrOptions];
  groups.forEach((groupSet) => {
    Object.values(groupSet ?? {}).flat().forEach((option) => {
      if (!option?.id) return;
      byId.set(option.id, option);
      const nameKey = String(option.name ?? "").toLowerCase();
      if (!nameKey) return;
      const bucket = nameBuckets.get(nameKey) ?? [];
      bucket.push(option);
      nameBuckets.set(nameKey, bucket);
    });
  });
  const byName = new Map();
  const ambiguousNames = new Set();
  nameBuckets.forEach((options, name) => {
    const uniqueIds = new Set(options.map((option) => option.id));
    if (uniqueIds.size === 1) byName.set(name, options[0]);
    else ambiguousNames.add(name);
  });
  return { byId, byName, ambiguousNames };
}

function findMatchingOption({ optionId, name, optionMap }) {
  if (optionMap instanceof Map) {
    const matchedById = optionId ? optionMap.get(optionId) : null;
    if (matchedById) return { option: matchedById, matchedByNameOnly: false, ambiguousName: false };
    const matchedByLegacyName = !optionId && name ? optionMap.get(name.toLowerCase()) : null;
    return { option: matchedByLegacyName ?? null, matchedByNameOnly: Boolean(matchedByLegacyName), ambiguousName: false };
  }

  const matchedById = optionId ? optionMap?.byId?.get(optionId) : null;
  if (matchedById) return { option: matchedById, matchedByNameOnly: false, ambiguousName: false };
  const nameKey = String(name ?? "").toLowerCase();
  if (!optionId && nameKey && optionMap?.ambiguousNames?.has(nameKey)) {
    return { option: null, matchedByNameOnly: false, ambiguousName: true };
  }
  const matchedByName = !optionId && nameKey ? optionMap?.byName?.get(nameKey) : null;
  return { option: matchedByName ?? null, matchedByNameOnly: Boolean(matchedByName), ambiguousName: false };
}

function validateActionEconomy(pieces) {
  const explicitActions = pieces.filter((piece) => isExplicitActionSlot(piece?.slot));
  const explicitBonusActions = pieces.filter((piece) => isBonusPiece(piece));
  const warnings = [];
  if (explicitActions.length > 1) {
    warnings.push("Plan appears to use more than one explicit Action.");
  }
  if (explicitBonusActions.length > 1) {
    warnings.push("Plan appears to use more than one Bonus Action.");
  }
  return warnings;
}

function isExplicitActionSlot(slot) {
  const normalized = String(slot ?? "").trim().toLowerCase();
  return normalized === "action" || normalized === "main action";
}

export function parseJson(text) {
  const raw = String(text ?? "").trim();
  try {
    return JSON.parse(raw);
  } catch {
    const extracted = extractFirstJsonObject(raw);
    if (!extracted) {
      throw new Error("AI returned a recommendation response that was not valid JSON.");
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

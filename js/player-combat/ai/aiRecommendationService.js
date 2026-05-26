import { requestAiChat } from "./aiClient.js";
import { AI_RECOMMENDATION_SYSTEM_PROMPT } from "./aiRecommendationPrompt.js";
import { compactContextForRequest } from "./aiRecommendationRequestContext.js";
import {
  FALLBACK_JSON_PROMPT,
  JSON_ONLY_PROMPT,
  recommendationResponseFormat
} from "./aiRecommendationResponseContract.js";
import {
  recommendationContractWarnings,
  validateStrictPlanPiece
} from "./aiRecommendationPostValidation.js";

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
    "- Each recommendation must include goalFit, expectedOutcome, legality, confidence, riskLevel, resourcesUsed, concentrationImpact, rejectedAlternatives, and followUpQuestions.",
    "- Every recommendation should consider the whole turn: main action, bonus action, movement, free/object interaction, and a relevant reaction reminder.",
    "- Use optionId values from optionIndex only. availableOptions is only a grouping aid.",
    "- Use candidatePackage and referenceSummaries to assemble complete legal plans; optionIndex remains the source of truth for every actionable piece.",
    "- Include all goal-relevant castable spells from candidatePackage; do not discard a spell only because deterministicRecommendations ranked it low.",
    "- Use clarification.prompts and missingInfo for facts that would materially change ranking; still provide conditional recommendations if the user skipped them.",
    "- Every optionId and name must match the same optionIndex entry exactly; never attach one option's name or explanation to another optionId.",
    "- Read optionAudit before ranking. Treat deterministicRecommendations as candidate ideas, not as truth; ignore or downgrade entries listed in optionAudit.",
    "- Use selectedCreatures for hidden target AC, defenses, saves, traits, and likely tactics, but do not print unrevealed stat-block details back to the player.",
    "- Use battlefieldKnowledge to avoid obviously poor damage types or tactics against named creatures from the notes.",
    "- Do not rank avoided damage types as good attacks when the optionIndex contains viable alternatives.",
    "- Use classTactics only to rank, explain, warn, or identify missing information; do not treat them as extra options.",
    "- Each non-null planPiece optionId must reference one concrete option from optionIndex.",
    "- If a turn slot has no useful option, represent it as name \"None\" with optionId null.",
    "- Combine compatible pieces when useful: attacks, Extra Attack pieces, bonus actions, riders, resource spends, free/object interactions, movement, and reaction reminders.",
    "- Strong bonus-action setup spells such as Hex or Hunter's Mark should be included with a compatible attack when available, legal, in range, and the character is not already concentrating.",
    "- Do not fill a bonus action merely because one exists. Include a bonus action only when it improves damage, survival, positioning, resource needs, or the player's goal.",
    "- Examples of useful combinations include Steady Aim plus Longbow plus Sneak Attack, weapon attack plus Divine Smite, and monk weapon plus Flurry of Blows when those option IDs are present.",
    "- Include class-feature riders such as Sneak Attack, Divine Smite, Stunning Strike, or Flurry of Blows only when they appear as provided options; mark hit-triggered riders conditional if the hit has not happened yet.",
    "- Do not include more than one explicit Action or one Bonus Action unless the app-provided option is an Extra Attack/attack-count piece.",
    "- Include different tactical categories when useful.",
    "- Mark plans conditional if range, line of sight, target validity, concentration, or resources are uncertain.",
    "- Prefer strong ranged options over closing to melee for fragile or wounded characters unless the provided context supports closing.",
    "- Account for terrain hazards and end-of-turn danger before ranking a high-damage plan above a defensive or repositioning plan.",
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
    .filter((set) => !set.rejected)
    .sort((left, right) => left.rank - right.rank);

  return {
    guidance: stringOr(parsed?.guidance, ""),
    turnAssessment: stringOr(parsed?.turnAssessment, ""),
    recommendedOptionId: stringOr(parsed?.recommendedOptionId, ""),
    missingInfo: arrayOfStrings(parsed?.missingInfo).slice(0, 8),
    optionAudit: normalizeOptionAudit(parsed?.optionAudit),
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
    ...validateActionEconomy(pieces),
    ...validateBattlefieldKnowledge(pieces, optionMap?.battlefieldKnowledge),
    ...recommendationContractWarnings({
      set: safeSet,
      pieces,
      resourcesUsed: arrayOfStrings(safeSet.resourcesUsed),
      optionMap
    })
  ];
  const warnings = [...arrayOfStrings(safeSet.warnings), ...validationWarnings].slice(0, 8);
  const hasRejectedPiece = pieces.some((piece) => piece.rejected);
  const legality = hasRejectedPiece
    ? "invalid"
    : validationWarnings.length
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
    goalFit: stringOr(safeSet.goalFit, ""),
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
    rejectedAlternatives: normalizeRejectedAlternatives(safeSet.rejectedAlternatives),
    whyNotHigher: stringOr(safeSet.whyNotHigher, ""),
    followUpQuestions: arrayOfStrings(safeSet.followUpQuestions).slice(0, 6),
    rejected: hasRejectedPiece,
    pieces
  };
}

function normalizeOptionAudit(value) {
  const audit = value && typeof value === "object" ? value : {};
  return {
    dataWarnings: arrayOfStrings(audit.dataWarnings).slice(0, 12),
    modelRelevantWarnings: arrayOfStrings(audit.modelRelevantWarnings).slice(0, 12),
    ignoredDeterministicRecommendations: arrayOfStrings(audit.ignoredDeterministicRecommendations).slice(0, 12),
    candidateDowngrades: arrayOfStrings(audit.candidateDowngrades).slice(0, 12),
    highValueTacticalHooks: arrayOfStrings(audit.highValueTacticalHooks).slice(0, 12)
  };
}

function normalizeRejectedAlternatives(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 8).map((entry) => ({
    optionId: stringOr(entry?.optionId, ""),
    name: stringOr(entry?.name, ""),
    reason: stringOr(entry?.reason, "")
  })).filter((entry) => entry.optionId || entry.name || entry.reason);
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
    .map((piece) => normalizeActionPiece(piece, optionMap, stringOr(piece?.slot, "Action")));
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

  const optionId = piece.optionId === null ? null : stringOr(piece.optionId, "");
  const name = stringOr(piece.name, "");
  const slot = stringOr(piece.slot, fallbackSlot);
  const strictResult = validateStrictPlanPiece({ slot, optionId, name, explanation: stringOr(piece.explanation, ""), optionMap });
  if (strictResult) {
    return {
      slot,
      optionId: strictResult.optionId,
      name: strictResult.name,
      explanation: stringOr(piece.explanation, ""),
      option: strictResult.option,
      validation: strictResult.validation,
      rejected: strictResult.rejected
    };
  }

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
    slot,
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
  const optionIndex = Array.isArray(contextOrOptions?.optionIndex) ? contextOrOptions.optionIndex : null;
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
  const availableById = new Map(byId);
  if (optionIndex) {
    byId.clear();
    optionIndex.forEach((option) => {
      if (!option?.id) return;
      byId.set(option.id, availableById.get(option.id) ?? option);
    });
  }
  const byName = new Map();
  const ambiguousNames = new Set();
  nameBuckets.forEach((options, name) => {
    const uniqueIds = new Set(options.map((option) => option.id));
    if (uniqueIds.size === 1) byName.set(name, options[0]);
    else ambiguousNames.add(name);
  });
  return {
    byId,
    byName,
    ambiguousNames,
    battlefieldKnowledge: contextOrOptions?.battlefieldKnowledge,
    strictIds: Boolean(optionIndex),
    options: [...byId.values()],
    currentConcentration: contextOrOptions?.combatState?.concentration ?? contextOrOptions?.combatState?.current?.concentration ?? "",
    tacticalFacts: contextOrOptions?.tacticalFacts ?? {}
  };
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

function validateBattlefieldKnowledge(pieces, battlefieldKnowledge = {}) {
  const avoid = new Set((battlefieldKnowledge.avoidDamageTypes ?? []).map((type) => String(type).toLowerCase()));
  if (!avoid.size) return [];
  const warnings = [];
  pieces.forEach((piece) => {
    const matchedTypes = optionDamageTypes(piece.option).filter((type) => avoid.has(type));
    if (matchedTypes.length) {
      warnings.push(`"${piece.option.name}" deals ${matchedTypes.join("/")} damage, which battlefield notes say to avoid.`);
    }
  });
  return [...new Set(warnings)];
}

function optionDamageTypes(option) {
  if (!option) return [];
  return [
    ...(Array.isArray(option.damageTypes) ? option.damageTypes : []),
    ...(Array.isArray(option.rolls) ? option.rolls.map((roll) => roll.damageType ?? roll.typeLabel) : [])
  ].filter(Boolean).map((type) => String(type).toLowerCase()).filter((type, index, types) => types.indexOf(type) === index);
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
  return enumOr(value, ["best_overall", "balanced", "damage", "defense", "support", "control", "mobility", "resource_conserving", "escape_or_reposition", "other"], "other");
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

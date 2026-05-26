import { PLAN_PIECE_SLOTS, validateSeedPlans } from "./aiSeedPlanBuilder.js";

export function validateStrictPlanPiece({ slot, optionId, name, explanation, optionMap }) {
  if (!optionMap?.strictIds) return null;
  const slotValidation = [];
  if (!PLAN_PIECE_SLOTS.includes(slot)) slotValidation.push(`Plan piece slot "${slot}" is not an allowed slot.`);
  if (isNonePiece(optionId, name)) {
    return { option: null, optionId: null, name: "None", validation: slotValidation, rejected: false };
  }

  const validation = [...slotValidation];
  if (!optionId) validation.push("Plan piece is missing an optionId from optionIndex.");
  const matched = optionId ? optionMap.byId?.get(optionId) : null;
  if (optionId && !matched) validation.push(`No optionIndex entry found for optionId "${optionId}".`);
  if (matched && name && !sameName(name, matched.name)) {
    validation.push(`Plan piece name "${name}" does not match optionIndex name "${matched.name}" for ${optionId}.`);
  }
  if (matched) {
    const otherName = mentionedDifferentOptionName(explanation, matched, optionMap.options);
    if (otherName) validation.push(`Plan piece explanation appears to describe "${otherName}" instead of "${matched.name}".`);
  }

  if (validation.length) {
    return {
      option: null,
      optionId: "",
      name: name || optionId || "Invalid option",
      validation,
      rejected: true
    };
  }

  return {
    option: matched,
    optionId: matched.id,
    name: matched.name,
    validation: [],
    rejected: false
  };
}

export function recommendationContractWarnings({ set, pieces, resourcesUsed, optionMap }) {
  const warnings = [];
  const text = recommendationText(set);
  if (resourcesUsed.length && /\bno resource cost\b|\bno resources?\b|\bresource[- ]?free\b/i.test(text)) {
    warnings.push("Recommendation claims no resource cost but resourcesUsed is non-empty.");
  }
  if (optionMap?.currentConcentration && /\bhex\b/i.test(optionMap.currentConcentration) && castsHex(pieces)) {
    if (!/\b(retarget|re-?target|recast|re-cast|new target|previous target|original target|move hex)\b/i.test(text)) {
      warnings.push("Recommendation casts Hex while already concentrating on Hex without explaining a legal retarget or recast reason.");
    }
  }
  const seedValidation = validateSeedPlans([{
    id: set?.id || "ai-response-plan",
    title: set?.title || "AI response plan",
    category: set?.category || "other",
    planPieces: pieces.map((piece) => ({
      slot: piece.slot,
      optionId: piece.optionId || null,
      name: piece.name,
      explanation: piece.explanation
    })),
    resourcesUsed,
    concentrationImpact: set?.concentrationImpact || "none",
    warnings: Array.isArray(set?.warnings) ? set.warnings : [],
    assumptions: Array.isArray(set?.assumptions) ? set.assumptions : []
  }], optionMap?.options ?? [], optionMap?.tacticalFacts ?? {});
  warnings.push(...seedValidation.warnings.map((warning) => warning.replace(/^Removed seed plan "[^"]+":\s*/, "")));
  return warnings;
}

function castsHex(pieces) {
  return pieces.some((piece) => /\bhex\b/i.test(piece?.option?.name ?? piece?.name ?? ""));
}

function recommendationText(set) {
  return [
    set?.title,
    set?.explanation,
    set?.whyNotHigher,
    ...(Array.isArray(set?.reasons) ? set.reasons : []),
    ...(Array.isArray(set?.warnings) ? set.warnings : []),
    ...(Array.isArray(set?.planPieces) ? set.planPieces.map((piece) => piece?.explanation) : [])
  ].filter(Boolean).join(" ");
}

function isNonePiece(optionId, name) {
  return !optionId && /^none$/i.test(String(name ?? "").trim());
}

function mentionedDifferentOptionName(explanation, matched, options = []) {
  const text = String(explanation ?? "").toLowerCase();
  if (!text) return "";
  const matchedName = String(matched?.name ?? "").toLowerCase();
  return (options ?? [])
    .filter((option) => option?.id !== matched?.id)
    .map((option) => option.name)
    .filter((optionName) => String(optionName ?? "").trim().length >= 4)
    .find((optionName) => {
      const normalized = String(optionName).toLowerCase();
      return normalized !== matchedName && text.includes(normalized);
    }) ?? "";
}

function sameName(left, right) {
  return String(left ?? "").trim().toLowerCase() === String(right ?? "").trim().toLowerCase();
}

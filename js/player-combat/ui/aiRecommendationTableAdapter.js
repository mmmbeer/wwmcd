import { findOption } from "./actionOptionHandlers.js";

export function recommendationTableOptions(rankedRecommendations, aiResult, groups) {
  const procedural = rankedRecommendations.map((entry) => entry.option);
  const aiOptions = aiRecommendationOptions(aiResult, groups);
  if (!aiOptions.length) return procedural;

  const aiIds = new Set(aiOptions.map((option) => option.id));
  return [
    ...aiOptions,
    ...procedural.filter((option) => !aiIds.has(option.id))
  ];
}

function aiRecommendationOptions(result, groups) {
  const recommendations = result?.recommendations ?? result?.sets ?? result ?? [];
  if (!Array.isArray(recommendations) || !recommendations.length) return [];
  return recommendations
    .map((recommendation, index) => aiRecommendationOption(recommendation, index, result, groups))
    .filter(Boolean);
}

function aiRecommendationOption(recommendation, index, result, groups) {
  const optionId = primaryOptionId(recommendation);
  const option = optionId ? findOption(groups, optionId) : null;
  if (!option) return null;
  const warnings = [
    ...(recommendation.warnings ?? []),
    ...(result?.missingInfo?.length ? [`Missing info: ${result.missingInfo.join(", ")}`] : [])
  ];
  return {
    ...option,
    recommendation: {
      ...(option.recommendation ?? {}),
      source: "ai",
      rank: Number(recommendation.rank) || index + 1,
      score: recommendation.score,
      reasons: recommendation.reasons?.length ? recommendation.reasons : [recommendation.goalFit || recommendation.summary || recommendation.category || "AI recommendation"],
      warnings,
      guidance: result?.guidance || result?.turnAssessment || "",
      summary: recommendation.summary,
      explanation: firstConcretePiece(recommendation)?.explanation ?? "",
      pieces: recommendation.pieces ?? [],
      assumptions: recommendation.assumptions ?? [],
      confidence: recommendation.confidence,
      legality: recommendation.legality,
      category: recommendation.category,
      goalFit: recommendation.goalFit,
      riskLevel: recommendation.riskLevel,
      resourcesUsed: recommendation.resourcesUsed ?? [],
      concentrationImpact: recommendation.concentrationImpact,
      expectedOutcome: recommendation.expectedOutcome,
      rejectedAlternatives: recommendation.rejectedAlternatives ?? [],
      followUpQuestions: recommendation.followUpQuestions ?? [],
      whyNotHigher: recommendation.whyNotHigher
    }
  };
}

function primaryOptionId(recommendation) {
  return recommendation?.optionId || firstConcretePiece(recommendation)?.optionId || "";
}

function firstConcretePiece(recommendation) {
  return (recommendation?.pieces ?? []).find((piece) => piece?.optionId) ?? null;
}

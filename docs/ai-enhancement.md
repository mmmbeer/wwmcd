# AI Combat Recommendation Enhancements

## Purpose

Improve the D&D 5e combat turn recommendation system so that AI-generated turn plans are more reliable, tactical, legally constrained, and useful in the player-facing UI.

The current implementation already summarizes character data, combat state, available options, deterministic recommendations, and wizard answers before requesting ranked AI recommendations. The next improvement should make the model work from a clearer turn-planning contract, return richer structured data, and validate model output before it reaches the UI.

## Goals

1. Make AI recommendations more reliable under D&D 5e action economy.
2. Prevent the model from inventing actions, spells, resources, or character facts.
3. Separate legal, conditional, risky, and invalid recommendations.
4. Return recommendations in useful tactical categories.
5. Surface missing battlefield information that would materially change the recommendation.
6. Make the response easier to render as player-facing turn-plan cards.
7. Preserve backward compatibility where practical with the current recommendation card structure.
8. Bias AI ranking with class-specific tactical guidance without creating new legal options.

## Current Files

The relevant files are:

- `aiRecommendationContext.js`
- `aiRecommendationPrompt.js`
- `aiRecommendationService.js`
- `classTactics.js`

## Current Behavior

The existing implementation:

- Builds an AI context from the active character, combat state, wizard answers, grouped options, and deterministic recommendation sets.
- Summarizes character features, traits, equipment, spells, resources, combat state, and available option groups.
- Includes class-specific tactics for only the active character's classes.
- Sends the context to Groq using a structured JSON schema when available.
- Falls back to a JSON-only prompt when structured outputs are unsupported.
- Normalizes returned recommendations into ranked sets with pieces, reasons, and warnings.

This is a good baseline, but the AI response is still too permissive. The model can produce plausible recommendations that are not clearly legal, not clearly conditional, or not tied tightly enough to available option IDs.

---

# Enhancement Plan

## Class-Specific Tactical Instructions

### Objective

Give the model tactical priorities for the active character's class mix while preserving `availableOptions` as the source of truth.

### Current Implementation

`js/player-combat/ai/classTactics.js` exports `CLASS_TACTICS`, keyed by lowercase class name. Each class entry includes:

- `priorities`
- `checks`
- `resourceGuidance`
- `avoid`
- `reminderQuestions`

The AI context builder adds:

```js
classTactics: summarizeClassTactics(character)
```

Only classes present on the active normalized character are included. The current guidance covers:

- artificer
- barbarian
- bard
- cleric
- druid
- fighter
- monk
- paladin
- ranger
- rogue
- sorcerer
- warlock
- wizard

### Prompt Contract

The system prompt tells the model:

- Use `classTactics` as guidance for ranking and explaining plans.
- Class tactics are not extra abilities and do not create actions, features, resources, spells, or permissions.
- Confirm that character data and available options support a tactic before applying it.
- If a tactic depends on missing battlefield information, mark the recommendation conditional and include the missing fact in `missingInfo`.

### Acceptance Criteria

- The context includes `classTactics` for active character classes only.
- Multiclass characters include tactics for each supported class.
- Unsupported class names are omitted.
- Request context compaction preserves `classTactics`.
- AI prompt and user message distinguish ranking guidance from legal options.

## Phase 1: Improve the AI Context Shape

### Objective

Make the context more tactical and less like a loose character sheet summary.

The model should receive a clear turn-planning contract that describes action economy, spellcasting constraints, resource policy, legality policy, and tactical intent.

### Update `buildAiRecommendationContext`

Replace the current top-level context structure with a versioned context object.

```js
export function buildAiRecommendationContext({
  snapshot,
  groups,
  recommendationSets,
  answers,
  userNotes
}) {
  const character = snapshot.activeCharacter;
  const combatState = snapshot.combatState;
  const availableOptions = summarizeGroups(groups);

  return {
    schemaVersion: "combat-turn-recommendation/v2",

    character: summarizeCharacter(character),
    combatState: summarizeCombatState(combatState, character),

    turnRules: buildTurnRules(character, combatState),
    playerIntent: summarizePlayerIntent(answers, userNotes),

    availableOptions,
    unavailableOptions: summarizeUnavailableGroups(groups),
    optionIndex: buildOptionIndex(availableOptions),

    deterministicRecommendations: recommendationSets
      .slice(0, 5)
      .map(summarizeRecommendationSet),

    instructionHints: {
      useOnlyOptionIds: true,
      preferCompleteTurnPlans: true,
      markMissingInfoExplicitly: true,
      doNotInventEnemyStats: true,
      unavailableOptionsAreForAwarenessOnly: true
    }
  };
}
```

### Add `buildTurnRules`

```js
function buildTurnRules(character, combatState) {
  return {
    actionEconomy: {
      maxActions: 1,
      maxBonusActions: 1,
      maxReactions: 1,
      movementAvailable: character?.combat?.speed ?? null,
      freeInteractionAvailable: true
    },

    spellcasting: {
      spellcastingAbility: character?.spells?.spellcastingAbility ?? null,
      spellAttackBonus: character?.spells?.attackBonus ?? null,
      spellSaveDc: character?.spells?.saveDc ?? null,
      currentConcentration: combatState?.current?.concentration ?? null,
      note: "If recommending a concentration spell while already concentrating, warn that the existing concentration may end."
    },

    resourcePolicy: {
      conserveLimitedResourcesUnlessUseful: true,
      doNotSpendUnavailableResources: true,
      explainWhyAnyLimitedResourceIsWorthSpending: true
    },

    legalityPolicy: {
      useOnlyAvailableOptions: true,
      optionsWithAvailableFalseAreConditionalOrUnavailable: true,
      markUncertainRangeLineOfSightOrTargetingAsConditional: true
    }
  };
}
```

### Rename `wizard` to `playerIntent`

The current `wizard` key is confusing because “wizard” is also a D&D class. Replace it with `playerIntent`.

```js
function summarizePlayerIntent(answers = {}, userNotes) {
  return {
    goal: answers.goal || "best overall turn",
    situation: answers.situation || "",
    range: answers.distance || "",
    difficulty: answers.difficulty || "",
    resourcePreference: answers.resources || "",
    rollPreference: answers.rollMode || "",
    concentrationPreference: answers.concentration || "",
    userNotes: String(userNotes ?? "").trim()
  };
}
```

### Add `optionIndex`

The model should have a compact list of usable option IDs.

```js
function buildOptionIndex(availableOptions) {
  return Object.entries(availableOptions ?? {}).flatMap(([group, options]) =>
    (options ?? []).map((option) => ({
      id: option.id,
      name: option.name,
      group,
      available: option.available !== false,
      unavailableReasons: option.unavailableReasons ?? [],
      cost: option.cost ?? null,
      resource: option.resource ?? null,
      tags: option.tags ?? [],
      isSpell: Boolean(option.spell),
      spellLevel: option.spell?.level ?? null,
      concentration: option.spell?.concentration ?? false
    }))
  );
}
```

### Separate unavailable options

Unavailable options should not be mixed into the primary available option list.

```js
function summarizeGroups(groups = {}) {
  return Object.fromEntries(OPTION_GROUPS.map((group) => [
    group,
    (groups[group] ?? [])
      .filter((option) => option.available !== false)
      .slice(0, 40)
      .map(summarizeOption)
  ]));
}

function summarizeUnavailableGroups(groups = {}) {
  return Object.fromEntries(OPTION_GROUPS.map((group) => [
    group,
    (groups[group] ?? [])
      .filter((option) => option.available === false)
      .slice(0, 20)
      .map(summarizeOption)
  ]));
}
```

### Reduce long option summaries

Combat recommendations do not need long rules text for every option. Reduce summary length and prefer a tactical summary when available.

```js
summary: trimText(
  option.tacticalSummary
    ?? option.description
    ?? option.longDescription
    ?? option.featureAction?.description
    ?? option.spell?.reference?.description,
  350
)
```

### Acceptance Criteria

- The AI context includes `schemaVersion`, `turnRules`, `playerIntent`, `availableOptions`, `unavailableOptions`, and `optionIndex`.
- The top-level key `wizard` is removed or aliased only for backward compatibility.
- Unavailable options are no longer treated as ordinary available options.
- Option summaries are shorter and more tactical.
- Existing recommendation generation still works with the updated context.

---

# Phase 2: Strengthen the System Prompt

## Objective

Make the AI behave like a constrained turn-planning assistant rather than a general rules explainer.

## Update `aiRecommendationPrompt.js`

Replace the current system prompt with:

```js
export const AI_RECOMMENDATION_SYSTEM_PROMPT = `You are a D&D 5e combat turn planning assistant for a player-facing turn helper.

Use only the provided character data, combat state, available options, resources, spell slots, equipment, traits, features, conditions, player intent, deterministic recommendations, and turn rules.

Your job is to propose complete turn plans, not isolated actions.

Hard rules:
- Do not invent actions, spells, attacks, features, equipment, resources, enemies, distances, damage, conditions, or character facts.
- Prefer optionId references from availableOptions or optionIndex.
- Do not recommend options marked available=false unless the plan clearly marks them as conditional or unavailable.
- Respect action economy: normally one Action, one Bonus Action, movement, one free/object interaction, and one Reaction plan.
- Do not spend unavailable resources.
- Do not assume range, line of sight, advantage, disadvantage, enemy AC, saving throw bonuses, resistances, vulnerabilities, or exact HP unless provided.
- If legality depends on missing information, mark the plan as conditional and list the missing information.
- If recommending a concentration spell while the character is already concentrating, warn about replacing concentration.
- If recommending a limited resource, explain why the situation justifies spending it.

Return ranked turn plans in different tactical categories when possible:
- best_overall
- damage
- defense
- support
- control
- resource_conserving
- escape_or_reposition

Each plan should be player-friendly, concise, and practical at the table.`;
```

## Acceptance Criteria

- The prompt explicitly prevents invented actions, spells, resources, enemies, and battlefield facts.
- The prompt requires complete turn plans rather than isolated actions.
- The prompt requires tactical categories.
- The prompt requires uncertainty and missing information to be marked clearly.

---

# Phase 3: Expand the AI Response Contract

## Objective

Make the AI response more useful for the UI and safer to consume.

The current schema returns ranked recommendations with actions, reasons, and warnings. Expand it to include legality, risk, confidence, missing information, assumptions, resource use, concentration impact, and tactical category.

## Update fallback JSON prompt

Replace the existing fallback JSON prompt with:

```js
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
      "planPieces": [
        {
          "slot": "Attack 1",
          "optionId": "copy the exact id from an available option",
          "name": "copy the exact option name",
          "explanation": "why this piece belongs in the full turn"
        }
      ],
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
```

## Update `recommendationResponseFormat`

Replace the current schema with:

```js
function recommendationResponseFormat() {
  return {
    type: "json_schema",
    json_schema: {
      name: "combat_recommendations",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        required: [
          "turnAssessment",
          "recommendedOptionId",
          "missingInfo",
          "recommendations"
        ],
        properties: {
          turnAssessment: { type: "string" },
          recommendedOptionId: { type: "string" },
          missingInfo: {
            type: "array",
            items: { type: "string" }
          },
          recommendations: {
            type: "array",
            minItems: 1,
            maxItems: 6,
            items: {
              type: "object",
              additionalProperties: false,
              required: [
                "id",
                "rank",
                "category",
                "title",
                "score",
                "confidence",
                "legality",
                "riskLevel",
                "explanation",
                "expectedOutcome",
                "movement",
                "action",
                "bonusAction",
                "freeInteraction",
                "reactionPlan",
                "resourcesUsed",
                "concentrationImpact",
                "assumptions",
                "reasons",
                "warnings"
              ],
              properties: {
                id: { type: "string" },
                rank: { type: "integer" },
                category: {
                  type: "string",
                  enum: [
                    "best_overall",
                    "damage",
                    "defense",
                    "support",
                    "control",
                    "resource_conserving",
                    "escape_or_reposition",
                    "other"
                  ]
                },
                title: { type: "string" },
                score: { type: "number" },
                confidence: {
                  type: "string",
                  enum: ["low", "medium", "high"]
                },
                legality: {
                  type: "string",
                  enum: ["legal", "conditional", "risky", "invalid"]
                },
                riskLevel: {
                  type: "string",
                  enum: ["low", "medium", "high"]
                },
                explanation: { type: "string" },
                expectedOutcome: { type: "string" },
                movement: { type: "string" },
                action: actionPieceSchema(),
                bonusAction: actionPieceSchema(),
                freeInteraction: { type: "string" },
                reactionPlan: { type: "string" },
                resourcesUsed: {
                  type: "array",
                  items: { type: "string" }
                },
                concentrationImpact: { type: "string" },
                assumptions: {
                  type: "array",
                  items: { type: "string" }
                },
                reasons: {
                  type: "array",
                  items: { type: "string" }
                },
                warnings: {
                  type: "array",
                  items: { type: "string" }
                }
              }
            }
          }
        }
      }
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
```

## Acceptance Criteria

- AI responses include a top-level tactical assessment.
- AI responses include top-level missing information.
- Each recommendation includes category, confidence, legality, risk level, assumptions, resources used, and concentration impact.
- Each recommendation has clearly separated movement, action, bonus action, free interaction, and reaction plan.
- Each recommendation includes `planPieces` for every concrete option in the full turn, including extra attacks and class-feature riders when available.
- The schema remains strict.

---

# Phase 4: Improve the User Message Sent to the Model

## Objective

Give the model clearer per-request instructions without bloating the system prompt.

## Add `buildRecommendationUserMessage`

```js
function buildRecommendationUserMessage(context) {
  return [
    "Recommend practical D&D 5e turn plans for the current player character.",
    "",
    "Requirements:",
    "- Return ranked complete turn plans, not individual actions.",
    "- Use optionId values from optionIndex or availableOptions whenever possible.",
    "- Fill planPieces with every concrete option in the turn: attacks, extra attacks, class-feature riders, bonus actions, free actions, movement options, and reaction plans when they have option IDs.",
    "- For characters with multiple attacks, include separate planPieces such as Attack 1 and Attack 2 when supported by availableOptions or deterministicRecommendations.",
    "- Include class-feature riders such as Sneak Attack or Divine Smite only when they appear as provided options; mark hit-triggered riders conditional if the hit has not happened yet.",
    "- Include different tactical categories when possible.",
    "- Mark plans conditional if range, line of sight, target validity, concentration, or resources are uncertain.",
    "- Include missingInfo for facts that would materially change the recommendation.",
    "- Prefer useful, table-ready guidance over long rules explanation.",
    "",
    "Context JSON:",
    JSON.stringify(context)
  ].join("\n");
}
```

## Update request builders

```js
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
      {
        role: "system",
        content: `${AI_RECOMMENDATION_SYSTEM_PROMPT}\n${FALLBACK_JSON_PROMPT}`
      },
      { role: "user", content: buildRecommendationUserMessage(context) }
    ]
  };
}
```

## Acceptance Criteria

- Both structured and fallback requests use the same user-message builder.
- The model receives explicit request-specific requirements.
- Temperature is reduced for more consistent structured output.

---

# Phase 5: Add Post-Response Validation

## Objective

Prevent invented or unavailable options from silently reaching the UI as if they were valid recommendations.

The current normalization logic attempts to match by `optionId` or name, but unmatched options can still pass through. The enhanced version should preserve the recommendation but downgrade legality and add warnings.

## Replace `normalizeAiResponse`

```js
function normalizeAiResponse(text, availableOptions) {
  const parsed = parseJson(text);
  const sets = Array.isArray(parsed?.recommendations) ? parsed.recommendations : [];
  const optionMap = buildOptionMap(availableOptions);

  return {
    turnAssessment: stringOr(parsed?.turnAssessment, ""),
    recommendedOptionId: stringOr(parsed?.recommendedOptionId, ""),
    missingInfo: arrayOfStrings(parsed?.missingInfo).slice(0, 8),

    recommendations: sets.slice(0, 6)
      .map((set, index) => normalizeRecommendationSet(set, index, optionMap))
      .sort((left, right) => left.rank - right.rank)
  };
}
```

## Add recommendation normalization

```js
function normalizeRecommendationSet(set, index, optionMap) {
  const action = normalizeActionPiece(set.action, optionMap, "Action");
  const bonusAction = normalizeActionPiece(set.bonusAction, optionMap, "Bonus Action");

  const validationWarnings = [
    ...validateMatchedPiece(action),
    ...validateMatchedPiece(bonusAction)
  ];

  const warnings = [
    ...arrayOfStrings(set.warnings),
    ...validationWarnings
  ].slice(0, 8);

  const legality = validationWarnings.length
    ? downgradeLegality(stringOr(set.legality, "conditional"))
    : stringOr(set.legality, "conditional");

  return {
    id: stringOr(set.id, `ai-recommendation-${index + 1}`),
    rank: Number(set.rank) || index + 1,
    category: stringOr(set.category, "other"),
    title: stringOr(set.title, `AI turn plan ${index + 1}`),
    score: Number(set.score) || 0,
    confidence: stringOr(set.confidence, "medium"),
    legality,
    riskLevel: stringOr(set.riskLevel, "medium"),
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

    // Backward-compatible shape for existing UI cards.
    pieces: [action, bonusAction].filter(Boolean)
  };
}
```

## Add action-piece validation

```js
function normalizeActionPiece(piece, optionMap, fallbackSlot) {
  if (!piece || typeof piece !== "object") {
    return {
      slot: fallbackSlot,
      optionId: "",
      name: "None",
      explanation: "",
      option: null,
      validation: ["No action piece provided."]
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

function validateMatchedPiece(piece) {
  if (!piece) return [];

  const warnings = [...(piece.validation ?? [])];

  if (piece.option?.available === false) {
    warnings.push(
      `"${piece.option.name}" is marked unavailable: ${(piece.option.unavailableReasons ?? []).join(", ")}`
    );
  }

  return warnings;
}

function downgradeLegality(value) {
  if (value === "invalid") return "invalid";
  return "conditional";
}
```

## Acceptance Criteria

- Recommendations with unmatched option IDs are flagged.
- Recommendations using unavailable options are flagged.
- Such recommendations are downgraded to `conditional` unless already `invalid`.
- The UI still receives a usable recommendation object.
- Existing `pieces` rendering can continue to work.

---

# Phase 6: Improve JSON Parsing

## Objective

Make fallback JSON parsing more robust.

The current parser extracts from the first `{` to the last `}`, which can fail if the response contains extra braces in prose. Replace it with a balanced JSON object extractor.

## Replace `parseJson`

```js
function parseJson(text) {
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
```

## Add `extractFirstJsonObject`

```js
function extractFirstJsonObject(text) {
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      if (depth === 0) start = i;
      depth += 1;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0 && start !== -1) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}
```

## Acceptance Criteria

- Valid JSON still parses directly.
- Fallback parsing can extract the first balanced JSON object.
- Bad JSON throws a clear error.

---

# Phase 7: Add Clarification Handling

## Objective

Allow the UI to identify when the recommendation is too conditional and should ask the player for more battlefield information.

## Add helper

```js
export function shouldAskClarifyingQuestion(aiResult) {
  return (
    aiResult.missingInfo?.length >= 3 &&
    aiResult.recommendations?.every((rec) => rec.legality !== "legal")
  );
}
```

## Suggested UI Behavior

When `shouldAskClarifyingQuestion(aiResult)` returns true, show:

- “Answer 2 quick questions”
- “Show conditional recommendations anyway”

The assistant should not block recommendations entirely. It should let the player continue if they prefer speed over precision.

## Acceptance Criteria

- The service exposes a helper or metadata that tells the UI when clarification would materially improve the recommendations.
- Conditional recommendations can still be displayed.
- The UI can choose whether to ask follow-up questions.

---

# Implementation Notes

## Backward Compatibility

The enhanced normalized response changes the top-level return shape from an array to an object:

```js
{
  turnAssessment,
  recommendedOptionId,
  missingInfo,
  recommendations
}
```

If the current UI expects an array, either:

1. Update the UI to use `result.recommendations`, or
2. Temporarily return both shapes.

A transitional return shape could be:

```js
return {
  turnAssessment,
  recommendedOptionId,
  missingInfo,
  recommendations,
  sets: recommendations
};
```

Avoid keeping both long term.

## Recommended UI Card Fields

Each recommendation card should display:

- Title
- Category
- Legality badge
- Confidence badge
- Risk badge
- Movement
- Action
- Bonus Action
- Reaction Plan
- Resources Used
- Concentration Impact
- Reasons
- Warnings
- Assumptions

## Suggested Badges

Use badge styles for:

- `legal`
- `conditional`
- `risky`
- `invalid`
- `low confidence`
- `resource spend`
- `concentration`
- `missing info`

## Testing Scenarios

Create fixtures for:

1. Martial character with only attacks available.
2. Spellcaster with active concentration.
3. Character with no useful bonus action.
4. Character with low HP and defensive options.
5. Character with unavailable spell slots.
6. Character with enemies out of range.
7. Character with unclear line of sight.
8. Character with deterministic recommendations that should influence the AI.
9. Model response with invented option ID.
10. Model response with malformed JSON in fallback mode.

## Example Test Expectations

- The AI should not recommend a spell if the character has no slot for it.
- The AI should warn before replacing concentration.
- The AI should mark ranged attacks conditional if line of sight is unknown.
- The AI should downgrade invented option IDs to conditional.
- The AI should preserve a usable recommendation object even when validation warnings exist.
- The AI should return at least one resource-conserving option when useful.
- The AI should return a defensive option when the character is badly wounded.

---

# Suggested Implementation Order

1. Update `aiRecommendationContext.js`.
2. Update `aiRecommendationPrompt.js`.
3. Update the structured output schema in `aiRecommendationService.js`.
4. Update fallback prompt.
5. Add `buildRecommendationUserMessage`.
6. Update normalization and validation.
7. Improve JSON parsing.
8. Update the UI to consume the richer recommendation object.
9. Add fixtures and tests.

---

# Definition of Done

This enhancement is complete when:

- The AI receives a versioned tactical context.
- The model is explicitly constrained to use provided options and facts.
- Recommendations include category, legality, confidence, risk, assumptions, missing information, resources used, and concentration impact.
- Invented or unavailable options are detected and flagged.
- The UI can render recommendations as complete turn-plan cards.
- The app can identify when clarification would materially improve the recommendation.
- Existing deterministic recommendations still influence the final AI output.
- The system gracefully handles models that do not support structured outputs.

const SLOT_RULES = {
  "Action": "action",
  "Bonus Action": "bonus",
  "Movement": "movement",
  "Free/Object Interaction": "object",
  "Reaction": "reaction",
  "Rider": null,
  "Special": null
};

const CONCENTRATION_SPELLS = /\b(bane|bless|shield of faith|sanctuary|hex)\b/i;

export function buildDeterministicSeedPlans({ optionIndex = [], tacticalFacts = {}, playerIntent = {} } = {}) {
  const byId = indexById(optionIndex);
  const warnings = [];
  const plans = [
    damagePlan(byId, tacticalFacts),
    defensivePlan(byId, tacticalFacts),
    controlPlan(byId, tacticalFacts),
    meleeBurstPlan(byId, tacticalFacts)
  ].filter(Boolean);
  const validation = validateSeedPlans(plans, optionIndex, tacticalFacts);
  warnings.push(...validation.warnings);
  return {
    plans: validation.plans.slice(0, 4),
    warnings,
    modelRelevantWarnings: modelWarnings({ optionIndex, tacticalFacts, playerIntent })
  };
}

export function validateSeedPlans(plans = [], optionIndex = [], tacticalFacts = {}) {
  const byId = indexById(optionIndex);
  const warnings = [];
  const valid = [];
  (plans ?? []).forEach((plan) => {
    const problems = seedPlanProblems(plan, byId, tacticalFacts);
    if (problems.length) {
      warnings.push(`Removed seed plan "${plan?.title ?? plan?.id ?? "Untitled seed plan"}": ${problems.join(" ")}`);
      return;
    }
    valid.push(plan);
  });
  return { plans: valid, warnings };
}

function damagePlan(byId, facts) {
  const action = findOption(byId, ["spell_guiding_bolt"], /\bguiding bolt\b/i);
  if (!action) return null;
  return plan({
    id: "plan_guiding_bolt_cover",
    title: coverTitle("Guiding Bolt", facts),
    category: "damage",
    goalFit: "Strong damage plan that preserves current concentration and keeps distance.",
    riskLevel: "medium",
    confidence: facts.targetDistanceFt ? "high" : "medium",
    planPieces: [
      optionPiece("Action", action, "Cast Guiding Bolt at the target."),
      nonePiece("Bonus Action", hexNoneInstruction(facts)),
      movementPiece(byId, facts),
      nonePiece("Free/Object Interaction", "No useful object interaction."),
      reactionPiece(byId)
    ],
    resourcesUsed: resourcesFor(action),
    concentrationImpact: concentrationImpact(action, facts),
    expectedOutcome: "Good single-target damage and advantage setup while preserving concentration.",
    assumptions: rangeAssumptions(action, facts),
    warnings: movementWarnings(facts),
    rejectedAlternatives: rejectedInflictWounds(byId, facts),
    followUpQuestions: followUpQuestions(facts)
  });
}

function defensivePlan(byId, facts) {
  const action = findOption(byId, ["action_dodge", "basic_dodge"], /\bdodge\b/i)
    ?? findOption(byId, ["action_disengage", "basic_disengage"], /\bdisengage\b/i)
    ?? findOption(byId, ["action_dash", "basic_dash"], /\bdash\b/i);
  const sanctuary = findOption(byId, ["spell_sanctuary"], /\bsanctuary\b/i);
  if (!action && !sanctuary) return null;
  return plan({
    id: "plan_defensive_cover",
    title: "Defensive repositioning toward cover",
    category: "defense",
    goalFit: "Prioritizes survival and better positioning over immediate damage.",
    riskLevel: "low",
    confidence: facts.coverAvailable ? "medium" : "low",
    planPieces: [
      action ? optionPiece("Action", action, `${action.name} while repositioning defensively.`) : nonePiece("Action", "No defensive action is available in optionIndex."),
      sanctuary ? optionPiece("Bonus Action", sanctuary, "Cast Sanctuary only if you are not attacking this turn.") : nonePiece("Bonus Action", "No useful bonus action."),
      movementPiece(byId, facts),
      nonePiece("Free/Object Interaction", "No useful object interaction."),
      reactionPiece(byId)
    ],
    resourcesUsed: resourcesFor(sanctuary),
    concentrationImpact: concentrationImpact(sanctuary, facts),
    expectedOutcome: "Improves survivability while setting up a safer next turn.",
    assumptions: facts.coverAvailable ? ["Cover is reachable without provoking unacceptable danger."] : [],
    warnings: movementWarnings(facts),
    followUpQuestions: followUpQuestions(facts)
  });
}

function controlPlan(byId, facts) {
  const action = findOption(byId, ["spell_bane", "spell_bless", "spell_shield_of_faith"], /\b(bane|bless|shield of faith)\b/i);
  if (!action) return null;
  const warnings = concentrationWarnings(action, facts);
  return plan({
    id: `plan_control_${slug(action.name)}`,
    title: `${action.name} control plan`,
    category: "control",
    goalFit: "A control or support plan, but it may be worse than preserving Hex for a damage goal.",
    legality: warnings.length ? "conditional" : "legal",
    riskLevel: "medium",
    confidence: warnings.length ? "medium" : "high",
    planPieces: [
      optionPiece("Action", action, `Cast ${action.name} only if replacing current concentration is worth it.`),
      nonePiece("Bonus Action", "No useful bonus action."),
      movementPiece(byId, facts),
      nonePiece("Free/Object Interaction", "No useful object interaction."),
      reactionPiece(byId)
    ],
    resourcesUsed: resourcesFor(action),
    concentrationImpact: concentrationImpact(action, facts),
    expectedOutcome: "Trades current damage setup for a save-based or defensive effect.",
    assumptions: rangeAssumptions(action, facts),
    warnings: [...warnings, ...movementWarnings(facts)],
    followUpQuestions: followUpQuestions(facts)
  });
}

function meleeBurstPlan(byId, facts) {
  const action = findOption(byId, ["spell_inflict_wounds"], /\binflict wounds\b/i);
  if (!action) return null;
  const warnings = [
    ...rangeWarnings(action, facts),
    "Requires touch range and worsens positioning unless closing is acceptable."
  ];
  return plan({
    id: "plan_inflict_wounds_risky",
    title: "Risky Inflict Wounds burst",
    category: "damage",
    legality: warnings.length ? "conditional" : "legal",
    riskLevel: "high",
    confidence: facts.targetDistanceFt ? "medium" : "low",
    planPieces: [
      optionPiece("Action", action, "Cast Inflict Wounds only if you can safely reach touch range."),
      nonePiece("Bonus Action", "No useful bonus action."),
      movementPiece(byId, facts, "Move into touch range only if willing to accept the risk."),
      nonePiece("Free/Object Interaction", "No useful object interaction."),
      reactionPiece(byId)
    ],
    resourcesUsed: resourcesFor(action),
    concentrationImpact: concentrationImpact(action, facts),
    expectedOutcome: "High single-hit damage at the cost of risky positioning.",
    assumptions: ["You are willing to enter or remain in touch range."],
    warnings,
    rejectedAlternatives: rejectedGuidingBolt(byId),
    followUpQuestions: ["Are you willing to close to touch range?"]
  });
}

function seedPlanProblems(plan, byId, facts) {
  const problems = [];
  if (!plan || typeof plan !== "object" || !Object.keys(plan).length) return ["plan is empty or malformed."];
  if (!plan.id) problems.push("missing id.");
  if (!plan.title) problems.push("missing title.");
  const pieces = Array.isArray(plan.planPieces) ? plan.planPieces : [];
  if (!pieces.some((piece) => piece.optionId)) problems.push("has no actionable optionId.");
  const counts = { action: 0, bonus: 0, reaction: 0 };
  pieces.forEach((piece) => {
    if (!Object.hasOwn(SLOT_RULES, piece?.slot)) problems.push(`${piece?.slot ?? "Unknown slot"} is not an allowed slot.`);
    if (!piece?.optionId) return;
    const indexed = byId.get(piece.optionId);
    if (!indexed) {
      problems.push(`${piece.optionId} is missing from optionIndex.`);
      return;
    }
    if (piece.name !== indexed.name) problems.push(`${piece.optionId} is named "${piece.name}" but optionIndex names it "${indexed.name}".`);
    const expected = SLOT_RULES[piece.slot];
    if (expected && !indexed.cost?.[expected]) problems.push(`${piece.optionId} is incompatible with ${piece.slot}.`);
    if (piece.slot === "Action") counts.action += 1;
    if (piece.slot === "Bonus Action") counts.bonus += 1;
    if (piece.slot === "Reaction") counts.reaction += 1;
  });
  if (counts.action > 1) problems.push("has more than one Action.");
  if (counts.bonus > 1) problems.push("has more than one Bonus Action.");
  if (counts.reaction > 1) problems.push("has more than one Reaction reminder.");
  problems.push(...resourceProblems(plan, byId));
  problems.push(...conditionalProblems(plan, byId, facts));
  return problems;
}

function resourceProblems(plan, byId) {
  const listed = plan.resourcesUsed ?? [];
  const actual = plan.planPieces.flatMap((piece) => resourcesFor(byId.get(piece.optionId)));
  const problems = actual.filter((resource) => !listed.includes(resource)).map((resource) => `missing resource cost "${resource}".`);
  const extras = listed.filter((resource) => !actual.includes(resource));
  return [...problems, ...extras.map((resource) => `lists resource cost "${resource}" not used by plan pieces.`)];
}

function conditionalProblems(plan, byId, facts) {
  const problems = [];
  const text = [...(plan.warnings ?? []), ...(plan.assumptions ?? [])].join(" ");
  const hasConditionalMovement = plan.planPieces.some((piece) => piece.optionId && byId.get(piece.optionId)?.cost?.movement && piece.conditional);
  const hasMovement = plan.planPieces.some((piece) => piece.optionId && byId.get(piece.optionId)?.cost?.movement);
  if (hasMovement && facts.coverAvailable && !hasConditionalMovement && !/safe path|conditional|depends/i.test(text)) {
    problems.push("movement-dependent plan is not marked conditional.");
  }
  return problems;
}

function optionPiece(slot, option, instruction) {
  return { slot, optionId: option.id, name: option.name, instruction };
}

function nonePiece(slot, instruction) {
  return { slot, optionId: null, name: "None", instruction };
}

function movementPiece(byId, facts, instruction) {
  const option = findOption(byId, ["movement_walk"], /\bmove\b/i);
  if (!option) return nonePiece("Movement", "No movement option is available in optionIndex.");
  const coverInstruction = facts.coverAvailable
    ? `Move toward cover${facts.coverDistanceFt ? ` ${facts.coverDistanceFt} ft` : ""}${facts.coverDirection ? ` to the ${facts.coverDirection}` : ""} if the path is safe and line of sight remains useful.`
    : "Reposition only if it improves safety without losing useful line of sight.";
  return { ...optionPiece("Movement", option, instruction ?? coverInstruction), conditional: true };
}

function reactionPiece(byId) {
  const option = findOption(byId, ["spell_shield"], /\bshield\b/i)
    ?? findOption(byId, ["spell_absorb_elements"], /\babsorb elements\b/i)
    ?? [...byId.values()].find((entry) => entry.cost?.reaction);
  return option ? { ...optionPiece("Reaction", option, reactionInstruction(option)), conditional: true } : nonePiece("Reaction", "No useful reaction reminder.");
}

function reactionInstruction(option) {
  if (/shield/i.test(option.name)) return "Hold Shield for an attack that would otherwise hit.";
  if (/absorb elements/i.test(option.name)) return "Hold Absorb Elements for a triggering elemental damage hit.";
  return `Hold ${option.name} for its legal trigger.`;
}

function plan(value) {
  return {
    baseScore: 0,
    legality: "legal",
    ...value,
    assumptions: (value.assumptions ?? []).filter(Boolean),
    warnings: (value.warnings ?? []).filter(Boolean),
    rejectedAlternatives: value.rejectedAlternatives ?? [],
    followUpQuestions: value.followUpQuestions ?? []
  };
}

function modelWarnings({ optionIndex, tacticalFacts }) {
  const byId = indexById(optionIndex);
  return [
    tacticalFacts.currentConcentration === "Hex" ? "Hex is already active; do not recommend recasting Hex unless the target changed and moving/recasting is legal." : null,
    byId.has("spell_inflict_wounds") && tacticalFacts.targetDistanceFt ? `Inflict Wounds requires touch range from a current distance of ${tacticalFacts.targetDistanceFt} ft.` : null,
    tacticalFacts.coverAvailable ? "Movement toward cover is useful but conditional on a safe path." : null,
    tacticalFacts.targetDistanceFt ? `Use the concrete ${tacticalFacts.targetDistanceFt} ft distance from user notes.` : null
  ].filter(Boolean);
}

function concentrationImpact(option, facts) {
  if (!option) return "none";
  if (!isConcentration(option)) return facts.currentConcentration ? `Keeps current ${facts.currentConcentration} concentration.` : "none";
  if (facts.currentConcentration) return `Would replace current ${facts.currentConcentration} concentration.`;
  return `Starts concentration on ${option.name}.`;
}

function concentrationWarnings(option, facts) {
  if (isConcentration(option) && facts.currentConcentration) return [`Casting ${option.name} ends current ${facts.currentConcentration} concentration.`];
  return [];
}

function rangeWarnings(option, facts) {
  const normal = option?.range?.normal ?? (/touch/i.test(option?.range?.label ?? option?.spell?.range ?? "") ? 5 : null);
  if (!facts.targetDistanceFt || !normal) return ["Range depends on the target distance and path."];
  if (facts.targetDistanceFt > normal) return [`${option.name} is out of current range (${facts.targetDistanceFt} ft vs ${normal} ft) unless you move first.`];
  return [];
}

function rangeAssumptions(option, facts) {
  const warnings = rangeWarnings(option, facts);
  return warnings.length ? warnings : [`Target is within ${option.range?.label ?? option.spell?.range ?? "listed range"}.`];
}

function movementWarnings(facts) {
  return facts.coverAvailable ? ["Movement to cover depends on a safe path."] : [];
}

function followUpQuestions(facts) {
  return facts.coverAvailable ? ["Is the path to cover safe?"] : [];
}

function rejectedInflictWounds(byId, facts) {
  const option = findOption(byId, ["spell_inflict_wounds"], /\binflict wounds\b/i);
  if (!option) return [];
  const distance = facts.targetDistanceFt ? ` from ${facts.targetDistanceFt} ft` : "";
  return [{ optionId: option.id, name: option.name, reason: `Requires moving${distance} to touch range and worsens positioning.` }];
}

function rejectedGuidingBolt(byId) {
  const option = findOption(byId, ["spell_guiding_bolt"], /\bguiding bolt\b/i);
  return option ? [{ optionId: option.id, name: option.name, reason: "Safer ranged damage while preserving current positioning." }] : [];
}

function hexNoneInstruction(facts) {
  return facts.currentConcentration === "Hex"
    ? "Do not recast Hex because Hex is already active."
    : "No useful bonus action.";
}

function coverTitle(actionName, facts) {
  return facts.coverAvailable ? `${actionName}, then move toward cover` : actionName;
}

function resourcesFor(option) {
  if (!option) return [];
  if (typeof option.resource === "string" && option.resource) return [option.resource];
  const resource = option.cost?.resource;
  if (resource?.type === "spellSlot") return [`Level ${resource.level} spell slot`];
  return [];
}

function isConcentration(option) {
  return Boolean(option?.concentration) || CONCENTRATION_SPELLS.test(option?.name ?? "");
}

function findOption(byId, ids, pattern) {
  return ids.map((id) => byId.get(id)).find(Boolean)
    ?? [...byId.values()].find((option) => pattern.test(option.name));
}

function indexById(optionIndex) {
  return new Map((optionIndex ?? []).filter((option) => option?.id).map((option) => [option.id, option]));
}

function slug(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

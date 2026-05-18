import {
  actionBlockReason,
  conditionWarnings,
  hasMovementBlocker,
  movementBlockReason
} from "./conditionRules.js";

const ACTION_COSTS = {
  action: ["actionUsed", "Action already used."],
  bonus: ["bonusActionUsed", "Bonus action already used."],
  reaction: ["reactionUsed", "Reaction already used this round."],
  object: ["objectInteractionUsed", "Object interaction already used."]
};

export function applyActionEconomyRules(options, character, combatState) {
  return options.map((option) => {
    const reasons = [...(option.unavailableReasons ?? [])];
    const warnings = [...(option.warnings ?? [])];
    const cost = option.cost ?? {};

    for (const [costName, [turnKey, reason]] of Object.entries(ACTION_COSTS)) {
      if (cost[costName] && combatState?.turn?.[turnKey]) reasons.push(reason);
    }

    const movementBlock = movementBlockReason(option, combatState);
    if (movementBlock) reasons.push(movementBlock);

    if (cost.movement && !movementBlock) {
      const remaining = getMovementRemaining(character, combatState);
      if (remaining <= 0) reasons.push("No movement remaining.");
    }

    const actionBlock = actionBlockReason(option, combatState);
    if (actionBlock) reasons.push(actionBlock);

    warnings.push(...conditionWarnings(option, combatState));

    return {
      ...option,
      available: reasons.length === 0,
      unavailableReasons: [...new Set(reasons)],
      warnings: [...new Set(warnings)]
    };
  });
}

export function groupOptionsByTurnCost(options) {
  const groups = {
    recommended: options.filter((option) => option.recommended).slice(0, 6),
    actions: options.filter((option) => option.cost?.action && (option.source === "basic" || option.source === "feature")),
    attacks: options.filter((option) => option.source === "weapon" || option.tags?.includes("weapon") || option.tags?.includes("unarmed")),
    bonus: options.filter((option) => option.cost?.bonus || option.spell?.castingCost === "bonus"),
    reaction: options.filter((option) => option.cost?.reaction || option.spell?.castingCost === "reaction"),
    movement: options.filter((option) => option.cost?.movement || option.group === "movement"),
    free: options.filter((option) => option.cost?.object && !option.cost?.action),
    spells: options.filter((option) => option.source === "spell"),
    resources: options.filter((option) => option.resource || option.cost?.resource),
    log: []
  };

  if (!groups.recommended.length) {
    groups.recommended = options.filter((option) => option.available).slice(0, 6);
  }

  return groups;
}

export function getMovementRemaining(character, combatState) {
  if (hasMovementBlocker(combatState)) return 0;
  const speed = Number(character?.combat?.speed?.walk ?? 0);
  return Math.max(0, speed - Number(combatState?.turn?.movementUsed ?? 0));
}

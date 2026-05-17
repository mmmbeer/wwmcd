const ACTION_COSTS = {
  action: ["actionUsed", "Action already used."],
  bonus: ["bonusActionUsed", "Bonus action already used."],
  reaction: ["reactionUsed", "Reaction already used this round."],
  object: ["objectInteractionUsed", "Object interaction already used."]
};

const BLOCKING_CONDITIONS = new Set(["incapacitated", "paralyzed", "petrified", "stunned", "unconscious"]);

export function applyActionEconomyRules(options, character, combatState) {
  return options.map((option) => {
    const reasons = [...(option.unavailableReasons ?? [])];
    const cost = option.cost ?? {};

    for (const [costName, [turnKey, reason]] of Object.entries(ACTION_COSTS)) {
      if (cost[costName] && combatState?.turn?.[turnKey]) reasons.push(reason);
    }

    if (cost.movement) {
      const remaining = getMovementRemaining(character, combatState);
      if (remaining <= 0) reasons.push("No movement remaining.");
    }

    for (const condition of combatState?.current?.conditions ?? []) {
      if (BLOCKING_CONDITIONS.has(String(condition).toLowerCase()) && affectsBlockedOption(option)) {
        reasons.push(`${condition} prevents actions and movement.`);
      }
    }

    return {
      ...option,
      available: reasons.length === 0,
      unavailableReasons: reasons
    };
  });
}

export function groupOptionsByTurnCost(options) {
  const groups = {
    recommended: options.filter((option) => option.recommended).slice(0, 6),
    actions: options.filter((option) => option.cost?.action),
    bonus: options.filter((option) => option.cost?.bonus),
    movement: options.filter((option) => option.cost?.movement || option.group === "movement"),
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
  const speed = Number(character?.combat?.speed?.walk ?? 0);
  return Math.max(0, speed - Number(combatState?.turn?.movementUsed ?? 0));
}

function affectsBlockedOption(option) {
  return option.cost?.action || option.cost?.bonus || option.cost?.reaction || option.cost?.movement;
}

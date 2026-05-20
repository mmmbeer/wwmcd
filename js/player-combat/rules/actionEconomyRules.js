import {
  actionBlockReason,
  conditionWarnings,
  hasMovementBlocker,
  movementBlockReason
} from "./conditionRules.js";
import { getEffectiveWalkSpeed } from "./movementRules.js";

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

    const resourceBlock = resourceBlockReason(option, character, combatState);
    if (resourceBlock) reasons.push(resourceBlock);

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

function resourceBlockReason(option, character, combatState) {
  const resource = option.cost?.resource;
  if (!resource) return null;
  if (resource.type === "spellSlot") {
    const max = spellSlotMax(character?.resources?.spellSlots?.[resource.level]);
    const used = Number(combatState?.resourcesUsed?.spellSlots?.[resource.level] ?? 0);
    return used < max ? null : `No level ${resource.level} spell slots remaining.`;
  }
  if (resource.type !== "classResource") return null;
  const match = findClassResource(character, resource.id) ?? inlineResource(resource);
  if (!match) return `${resource.name ?? "Resource"} is not tracked.`;
  const max = Number(match.max ?? 0);
  const used = Number(combatState?.resourcesUsed?.classResources?.[match.id] ?? 0);
  const remaining = Math.max(0, max - used);
  const amount = Number(resource.amount ?? 1);
  return remaining >= amount ? null : `${match.name} has no uses remaining.`;
}

function spellSlotMax(value) {
  if (value && typeof value === "object") return Number(value.available ?? value.max ?? value.value ?? 0);
  return Number(value ?? 0);
}

export function groupOptionsByTurnCost(options) {
  const groups = {
    recommended: options.filter((option) => option.recommended).slice(0, 6),
    actions: options.filter((option) => option.cost?.action && (option.source === "basic" || option.source === "feature")),
    attacks: options.filter((option) => option.source === "weapon" || option.tags?.includes("weapon") || option.tags?.includes("unarmed")),
    bonus: options.filter((option) => option.cost?.bonus || option.spell?.castingCost === "bonus"),
    reaction: options.filter((option) => option.cost?.reaction || option.spell?.castingCost === "reaction"),
    movement: options.filter((option) => option.cost?.movement || option.group === "movement"),
    free: options.filter((option) => option.group === "free" || (option.cost?.object && !option.cost?.action)),
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
  const speed = getEffectiveWalkSpeed(character);
  return Math.max(0, speed - Number(combatState?.turn?.movementUsed ?? 0));
}

function findClassResource(character, resourceId) {
  return [
    ...(character?.resources?.classResources ?? []),
    ...(character?.resources?.limitedUses ?? [])
  ].find((resource) => resource.id === resourceId);
}

function inlineResource(resource) {
  const max = Number(resource?.max ?? 0);
  return max > 0 && resource?.id ? resource : null;
}

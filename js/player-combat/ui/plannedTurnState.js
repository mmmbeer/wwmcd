const EMPTY_PLAN = Object.freeze({
  action: null,
  bonusAction: null,
  reaction: null,
  freeActions: [],
  movementUsed: 0,
  resourcesToSpend: []
});

let plannedTurn = clonePlan(EMPTY_PLAN);

export function getPlannedTurn() {
  return clonePlan(plannedTurn);
}

export function getPlannedTurnOptions() {
  return [
    plannedTurn.action,
    plannedTurn.bonusAction,
    plannedTurn.reaction,
    ...plannedTurn.freeActions
  ].filter(Boolean);
}

export function clearPlannedTurn({ silent = false } = {}) {
  plannedTurn = clonePlan(EMPTY_PLAN);
  if (!silent) notifyPlanChanged();
}

export function isOptionPlanned(option) {
  if (!option) return false;
  return [
    plannedTurn.action,
    plannedTurn.bonusAction,
    plannedTurn.reaction,
    ...plannedTurn.freeActions
  ].some((entry) => entry?.id === option.id);
}

export function validatePlannedOption(option, { combatState = null } = {}) {
  if (!option || option.available === false) return { ok: false, message: unavailableMessage(option) };
  const spellBlock = leveledSpellBlockReason(option, combatState);
  return spellBlock ? { ok: false, message: spellBlock } : { ok: true };
}

export function selectPlannedOption(option, { combatState = null } = {}) {
  const validation = validatePlannedOption(option, { combatState });
  if (!validation.ok) return validation;

  if (option.cost?.movement) {
    const step = Number(option.movement?.step ?? 5);
    const remaining = Number(option.movement?.remaining ?? 0);
    plannedTurn = {
      ...plannedTurn,
      movementUsed: clamp(plannedTurn.movementUsed + step, 0, remaining)
    };
    notifyPlanChanged();
    return { ok: true };
  }

  if (option.cost?.bonus) plannedTurn = { ...plannedTurn, bonusAction: option };
  else if (option.cost?.reaction) plannedTurn = { ...plannedTurn, reaction: option };
  else if (option.cost?.object || !option.cost?.action) plannedTurn = toggleFreeOption(plannedTurn, option);
  else plannedTurn = { ...plannedTurn, action: option };

  plannedTurn = {
    ...plannedTurn,
    resourcesToSpend: plannedResources(plannedTurn)
  };
  notifyPlanChanged();
  return { ok: true };
}

export function confirmPlannedTurn(stateManager) {
  const plan = getPlannedTurn();
  const options = [
    plan.action,
    plan.bonusAction,
    plan.reaction,
    ...plan.freeActions
  ].filter(Boolean);

  if (stateManager.useCombatOptions) {
    stateManager.useCombatOptions(options, { movementUsed: plan.movementUsed });
  } else {
    options.forEach((option) => stateManager.useCombatOption(option));
    if (plan.movementUsed > 0) stateManager.useMovement(plan.movementUsed);
  }
  clearPlannedTurn({ silent: true });
  notifyPlanChanged();
  return { optionCount: options.length, movementUsed: plan.movementUsed };
}

function toggleFreeOption(plan, option) {
  const exists = plan.freeActions.some((entry) => entry.id === option.id);
  return {
    ...plan,
    freeActions: exists
      ? plan.freeActions.filter((entry) => entry.id !== option.id)
      : [...plan.freeActions, option]
  };
}

function plannedResources(plan) {
  return [
    plan.action,
    plan.bonusAction,
    plan.reaction,
    ...plan.freeActions
  ].map((option) => option?.cost?.resource).filter(Boolean);
}

function unavailableMessage(option) {
  return option.unavailableReasons?.join(" ") || `${option.name} is unavailable right now.`;
}

function leveledSpellBlockReason(option, combatState) {
  if (!isLeveledSpell(option)) return null;
  const alreadyCastName = combatState?.turn?.leveledSpellName;
  if (combatState?.turn?.leveledSpellCast) {
    return alreadyCastName
      ? `You already cast ${alreadyCastName}, a leveled spell, this turn.`
      : "You already cast a leveled spell this turn.";
  }
  const planned = getPlannedTurnOptions().find((entry) => isLeveledSpell(entry) && entry.id !== option.id);
  return planned ? `You already planned ${planned.name}, a leveled spell, this turn.` : null;
}

function isLeveledSpell(option) {
  return Boolean(option?.spell) && Number(option.spell?.level ?? 0) > 0;
}

function notifyPlanChanged() {
  window.dispatchEvent(new CustomEvent("combat:planned-turn-changed"));
}

function clonePlan(plan) {
  return {
    action: plan.action,
    bonusAction: plan.bonusAction,
    reaction: plan.reaction,
    freeActions: [...(plan.freeActions ?? [])],
    movementUsed: Number(plan.movementUsed ?? 0),
    resourcesToSpend: [...(plan.resourcesToSpend ?? [])]
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(Number(value || 0), min), max);
}

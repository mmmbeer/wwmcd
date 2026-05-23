import { attackCapacity, isAttackActionOption } from "../rules/attackActionRules.js";

const EMPTY_PLAN = Object.freeze({
  action: null,
  actionAttacks: [],
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

export function getPlannedOptionForSlot(option) {
  const slot = slotForOption(option);
  if (!slot) return null;
  if (slot === "freeActions") return plannedTurn.freeActions.find((entry) => entry?.id === option?.id) ?? null;
  if (slot === "action" && isAttackAction(option) && hasAttackSequence(plannedTurn)) {
    return plannedTurn.actionAttacks.find((entry) => entry?.id === option?.id) ?? plannedTurn.action;
  }
  return plannedTurn[slot] ?? null;
}

export function clearPlannedTurn({ silent = false } = {}) {
  plannedTurn = clonePlan(EMPTY_PLAN);
  if (!silent) notifyPlanChanged();
}

export function isOptionPlanned(option) {
  if (!option) return false;
  return [
    plannedTurn.action,
    ...plannedTurn.actionAttacks,
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
  else plannedTurn = selectActionOption(plannedTurn, option);

  plannedTurn = {
    ...plannedTurn,
    resourcesToSpend: plannedResources(plannedTurn)
  };
  notifyPlanChanged();
  return { ok: true };
}

export async function confirmPlannedTurn(stateManager, { beforeUseOption = null } = {}) {
  const plan = getPlannedTurn();
  const options = [
    plan.action,
    plan.bonusAction,
    plan.reaction,
    ...plan.freeActions
  ].filter(Boolean);
  const rollOptions = [
    ...(plan.actionAttacks.length ? plan.actionAttacks.map(singleAttackRollOption) : [plan.action]),
    plan.bonusAction,
    plan.reaction,
    ...plan.freeActions
  ].filter(Boolean);

  for (const option of rollOptions) {
    if (beforeUseOption) {
      const ok = await beforeUseOption(option);
      if (!ok) return { ok: false, canceled: true, optionCount: 0, movementUsed: 0 };
    }
  }

  if (stateManager.useCombatOptions) {
    stateManager.useCombatOptions(options, { movementUsed: plan.movementUsed });
  } else {
    options.forEach((option) => stateManager.useCombatOption(option));
    if (plan.movementUsed > 0) stateManager.useMovement(plan.movementUsed);
  }
  clearPlannedTurn({ silent: true });
  notifyPlanChanged();
  return { ok: true, optionCount: options.length, movementUsed: plan.movementUsed };
}

function singleAttackRollOption(option) {
  return {
    ...option,
    attack: { ...(option.attack ?? {}), count: 1 }
  };
}

function selectActionOption(plan, option) {
  if (!isAttackAction(option)) return { ...plan, action: option, actionAttacks: [] };
  if (!isAttackAction(plan.action)) return { ...plan, action: option, actionAttacks: [option] };

  const capacity = attackCapacity(plan.action);
  const current = hasAttackSequence(plan) ? plan.actionAttacks : [plan.action];
  if (current.length >= capacity) return { ...plan, action: option, actionAttacks: [option] };
  return { ...plan, action: plan.action, actionAttacks: [...current, option] };
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

function slotForOption(option) {
  if (!option || option.cost?.movement) return null;
  if (option.cost?.bonus) return "bonusAction";
  if (option.cost?.reaction) return "reaction";
  if (option.cost?.object || !option.cost?.action) return "freeActions";
  return "action";
}

function plannedResources(plan) {
  return [
    plan.action,
    plan.bonusAction,
    plan.reaction,
    ...plan.freeActions
  ].map((option) => option?.cost?.resource).filter(Boolean);
}

function hasAttackSequence(plan) {
  return (plan.actionAttacks?.length ?? 0) > 0;
}

function isAttackAction(option) {
  return isAttackActionOption(option);
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
    actionAttacks: [...(plan.actionAttacks ?? [])],
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

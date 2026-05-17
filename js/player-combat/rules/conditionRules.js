const ACTION_BLOCKERS = new Set(["incapacitated", "paralyzed", "petrified", "stunned", "unconscious"]);
const MOVEMENT_BLOCKERS = new Set(["grappled", "restrained"]);

const ATTACK_WARNINGS = {
  blinded: "Blinded: attacks you make may have disadvantage.",
  frightened: "Frightened: attacks may have disadvantage while the source is in sight.",
  poisoned: "Poisoned: attack rolls have disadvantage.",
  restrained: "Restrained: attacks you make have disadvantage."
};

const CHECK_WARNINGS = {
  frightened: "Frightened: ability checks may have disadvantage while the source is in sight.",
  poisoned: "Poisoned: ability checks have disadvantage."
};

export function conditionNames(combatState) {
  return (combatState?.current?.conditions ?? []).map((condition) => String(condition));
}

export function actionBlockReason(option, combatState) {
  if (!affectsBlockedOption(option)) return null;
  const blocker = conditionNames(combatState).find((condition) => ACTION_BLOCKERS.has(normalize(condition)));
  return blocker ? `${blocker} prevents actions and movement.` : null;
}

export function movementBlockReason(option, combatState) {
  if (!option.cost?.movement) return null;
  const blocker = conditionNames(combatState).find((condition) => MOVEMENT_BLOCKERS.has(normalize(condition)));
  return blocker ? `Movement blocked by ${blocker}.` : null;
}

export function conditionWarnings(option, combatState) {
  const warnings = [];
  const conditions = conditionNames(combatState).map(normalize);

  if (option.cost?.movement && conditions.includes("prone")) {
    warnings.push("Prone: standing costs half your speed.");
  }

  if (isAttackOption(option)) {
    for (const condition of conditions) {
      if (ATTACK_WARNINGS[condition]) warnings.push(ATTACK_WARNINGS[condition]);
    }
  }

  if (isCheckOption(option)) {
    for (const condition of conditions) {
      if (CHECK_WARNINGS[condition]) warnings.push(CHECK_WARNINGS[condition]);
    }
  }

  return [...new Set(warnings)];
}

export function hasMovementBlocker(combatState) {
  return conditionNames(combatState).some((condition) => MOVEMENT_BLOCKERS.has(normalize(condition)));
}

function affectsBlockedOption(option) {
  return option.cost?.action || option.cost?.bonus || option.cost?.reaction || option.cost?.movement;
}

function isAttackOption(option) {
  return option.tags?.includes("attack") || option.rolls?.some((roll) => roll.type === "attack");
}

function isCheckOption(option) {
  return option.rolls?.some((roll) => roll.type === "check");
}

function normalize(condition) {
  return String(condition).trim().toLowerCase();
}

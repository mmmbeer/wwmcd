import {
  applyActionEconomyRules,
  getMovementRemaining,
  groupOptionsByTurnCost
} from "./actionEconomyRules.js";
import { getBasicActions } from "./basicActions.js";
import { getResourceActions } from "./resourceActions.js";
import { getSpellActions } from "./spellActions.js";
import { getWeaponActions } from "./weaponActions.js";

export function getCombatOptions({ character, combatState, referenceData }) {
  if (!character || !combatState) return emptyGroups();

  const options = [
    movementOption(character, combatState),
    ...getBasicActions(character),
    ...getWeaponActions(character, referenceData),
    ...getSpellActions(character, combatState, referenceData),
    ...getResourceActions(character, combatState)
  ];

  const checked = applyActionEconomyRules(options, character, combatState);
  return groupOptionsByTurnCost(checked);
}

function movementOption(character, combatState) {
  const remaining = getMovementRemaining(character, combatState);
  const speed = Number(character?.combat?.speed?.walk ?? 0);
  return {
    id: "movement_walk",
    name: "Move",
    description: `${remaining} of ${speed} ft remaining.`,
    source: "basic",
    group: "movement",
    tags: ["movement"],
    cost: { movement: true },
    recommended: remaining > 0,
    rolls: [],
    meta: [`${remaining} ft remaining`]
  };
}

function emptyGroups() {
  return {
    recommended: [],
    actions: [],
    bonus: [],
    movement: [],
    spells: [],
    resources: [],
    log: []
  };
}

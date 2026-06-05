import {
  applyActionEconomyRules,
  getMovementRemaining,
  groupOptionsByTurnCost
} from "./actionEconomyRules.js";
import { getBasicActions } from "./basicActions.js";
import { getAdvancedFeatureActions } from "./advancedFeatureActions.js";
import { getFeatureActions } from "./featureActions.js";
import { getMonkActions } from "./monkActions.js";
import { getHighImpactFeatureActions } from "./highImpactFeatureActions.js";
import { getEffectiveWalkSpeed } from "./movementRules.js";
import { getResourceActions } from "./resourceActions.js";
import { getSpellActions } from "./spellActions.js";
import { getWeaponActions } from "./weaponActions.js";

const NULL_REFERENCE_DATA = {};
const optionsCache = new WeakMap();

export function getCombatOptions({ character, combatState, referenceData }) {
  if (!character || !combatState) return emptyGroups();

  const referenceKey = referenceData ?? NULL_REFERENCE_DATA;
  const cached = getCachedOptions(character, combatState, referenceKey);
  if (cached) return cached;

  const options = [
    movementOption(character, combatState, referenceData),
    ...getBasicActions(character, combatState),
    ...getWeaponActions(character, combatState, referenceData),
    ...getSpellActions(character, combatState, referenceData),
    ...getFeatureActions(character, combatState, referenceData),
    ...getMonkActions(character, combatState),
    ...getHighImpactFeatureActions(character, combatState, referenceData),
    ...getAdvancedFeatureActions(character, combatState, referenceData),
    ...getResourceActions(character, combatState)
  ];

  const checked = applyActionEconomyRules(options, character, combatState);
  const groups = groupOptionsByTurnCost(checked);
  setCachedOptions(character, combatState, referenceKey, groups);
  return groups;
}

function getCachedOptions(character, combatState, referenceKey) {
  return optionsCache.get(character)?.get(combatState)?.get(referenceKey) ?? null;
}

function setCachedOptions(character, combatState, referenceKey, groups) {
  let byState = optionsCache.get(character);
  if (!byState) {
    byState = new WeakMap();
    optionsCache.set(character, byState);
  }
  let byReference = byState.get(combatState);
  if (!byReference) {
    byReference = new WeakMap();
    byState.set(combatState, byReference);
  }
  byReference.set(referenceKey, groups);
}

function movementOption(character, combatState, referenceData) {
  const remaining = getMovementRemaining(character, combatState);
  const speed = getEffectiveWalkSpeed(character, referenceData);
  return {
    id: "movement_walk",
    name: "Move",
    description: `${remaining} of ${speed} remaining.`,
    source: "basic",
    group: "movement",
    tags: ["movement"],
    cost: { movement: true },
    recommended: remaining > 0,
    rolls: [],
    movement: { remaining, speed, step: 5 },
    meta: []
  };
}

function emptyGroups() {
  return {
    recommended: [],
    actions: [],
    attacks: [],
    bonus: [],
    reaction: [],
    movement: [],
    free: [],
    spells: [],
    resources: [],
    log: []
  };
}

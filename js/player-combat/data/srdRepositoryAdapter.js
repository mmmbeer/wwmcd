import { findByName, getClassIndex, getConditionIndex, getEquipmentIndex, getRaceIndex, getSpellIndex } from "./referenceDataService.js";

export function createSrdRepositoryAdapter() {
  return {
    findSpellByName: (name) => findByName(getSpellIndex(), name),
    findClassByName: (name) => findByName(getClassIndex(), name),
    findRaceByName: (name) => findByName(getRaceIndex(), name),
    findEquipmentByName: (name) => findByName(getEquipmentIndex(), name),
    findConditionByName: (name) => findByName(getConditionIndex(), name)
  };
}
